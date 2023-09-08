/* Copyright 2016 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

"use strict";

if (!window.pdfjsLib?.getDocument || !window.pdfjsViewer?.PDFViewer) {
  // eslint-disable-next-line no-alert
  throw new Error('Please build the pdfjs-dist library using\n `gulp dist-install`');
}

const TEXT_LAYER_MODE = 0; // DISABLE
const MAX_IMAGE_SIZE = 1024 * 1024;
const DEFAULT_URL = "assets/pdf-mobile-viewer.pdf";
const DEFAULT_SCALE_DELTA = 1.1;
const MIN_SCALE = 0.25;
const MAX_SCALE = 10.0;
const DEFAULT_SCALE_VALUE = "auto";
const params = new Proxy(new URLSearchParams(window.location.search), {
  get: (searchParams, prop) => searchParams.get(prop),
});
const selectors = {
  downloadPopup: '#download-popup'
};

window.pdfjsLib.GlobalWorkerOptions.workerSrc = "assets/pdf.worker.min.js";

class L10n {
  _lang;
  _languages;
  
  constructor(languages, langCode = 'es') {
    this._languages = languages;
    this._lang = this._languages?.[langCode] ? langCode : 'es';
  }
  setLanguage(langCode, dictionary = null) {
    if (dictionary) {
      this._languages[langCode] = dictionary;
    }
    this._lang = this._languages?.[langCode] ? langCode : 'es';
  }
  getLanguage() {
    return this._lang;
  }
  getDictionary() {
    return this._languages?.[this._lang] ?? {};
  }
  get(path, args, fallbackText = '') {
    const resolvePath = (object, path, defaultValue) => path
      .split('.')
      .reduce((o, p) => o ? o[p] : defaultValue, object)
    const texts = this.getDictionary();
    const text = resolvePath(texts, path) || '';
    if (args) {
      return Object.entries(args)
        .reduce((text, [key, value]) => text.replaceAll(`{{${key}}}`, value), text);
    }

    return text;
  }
}

const PDFViewerApplication = {
  pdfLoadingTask: null,
  pdfDocument: null,
  pdfViewer: null,
  pdfHistory: null,
  pdfLinkService: null,
  eventBus: null,
  l10n: null,

  async init(params) {
    await this.loadLanguages(params.lang);
    this.showDownloadPopup(params.showDownloadPopup);
    this.open(params);
  },

  async loadLanguages(lang = 'es') {
    const languagesPath = document.querySelector('link[type="application/l10n"]').href;
    const response = await fetch(languagesPath);
    this.l10n = new L10n(await response.json(), lang);

    document.querySelectorAll('[data-text]').forEach(dataText => {
      dataText.textContent = this.l10n.get(dataText.dataset.text);
    });

    document.querySelectorAll('[data-title-text]').forEach(dataTitleText => {
      dataTitleText.title = this.l10n.get(dataTitleText.dataset.titleText);
    });
  },

  /**
   * Opens PDF document specified by URL.
   * @returns {Promise} - Returns the promise, which is resolved when document
   *                      is opened.
   */
  async open(params) {
    if (this.pdfLoadingTask) {
      // We need to destroy already opened document
      await this.close();
    }

    const url = params.url;
    this.setTitleUsingUrl(url);

    // Loading document.
    const loadingTask = pdfjsLib.getDocument({
      url,
      maxImageSize: MAX_IMAGE_SIZE,
      cMapPacked: false,
    });
    this.pdfLoadingTask = loadingTask;

    loadingTask.onProgress = (progressData) => {
      this.progress(progressData.loaded / progressData.total);
    };

    try {
      const pdfDocument = await loadingTask.promise;
      // Document loaded, specifying document for the viewer.
      this.pdfDocument = pdfDocument;
      this.pdfViewer.setDocument(pdfDocument);
      this.pdfLinkService.setDocument(pdfDocument);
      this.pdfHistory.initialize({
        fingerprint: pdfDocument.fingerprints[0],
      });

      this.loadingBar.hide();
      this.setTitleUsingMetadata(pdfDocument);
    } catch (exception) {
      const message = exception && exception.message;
      const l10n = this.l10n;
      let loadingErrorMessage;

      if (exception instanceof pdfjsLib.InvalidPDFException) {
        // change error message also for other builds
        loadingErrorMessage = l10n.get(
          "invalid_file_error",
          null,
          "Invalid or corrupted PDF file."
        );
      } else if (exception instanceof pdfjsLib.MissingPDFException) {
        // special message for missing PDFs
        loadingErrorMessage = l10n.get(
          "missing_file_error",
          null,
          "Missing PDF file."
        );
      } else if (exception instanceof pdfjsLib.UnexpectedResponseException) {
        loadingErrorMessage = l10n.get(
          "unexpected_response_error",
          null,
          "Unexpected server response."
        );
      } else {
        loadingErrorMessage = l10n.get(
          "loading_error",
          null,
          "An error occurred while loading the PDF."
        );
      }

      this.error(loadingErrorMessage, { message });
      this.loadingBar.hide();
    }
  },

  /**
   * Closes opened PDF document.
   * @returns {Promise} - Returns the promise, which is resolved when all
   *                      destruction is completed.
   */
  close() {
    const errorWrapper = document.getElementById("errorWrapper");
    errorWrapper.hidden = true;

    if (!this.pdfLoadingTask) {
      return Promise.resolve();
    }

    const promise = this.pdfLoadingTask.destroy();
    this.pdfLoadingTask = null;

    if (this.pdfDocument) {
      this.pdfDocument = null;

      this.pdfViewer.setDocument(null);
      this.pdfLinkService.setDocument(null, null);

      if (this.pdfHistory) {
        this.pdfHistory.reset();
      }
    }

    return promise;
  },

  get loadingBar() {
    const bar = document.getElementById("loadingBar");
    return pdfjsLib.shadow(
      this,
      "loadingBar",
      new pdfjsViewer.ProgressBar(bar)
    );
  },

  setTitleUsingUrl: function pdfViewSetTitleUsingUrl(url) {
    this.url = url;
    let title = pdfjsLib.getFilenameFromUrl(url) || url;
    try {
      title = decodeURIComponent(title);
    } catch (e) {
      // decodeURIComponent may throw URIError,
      // fall back to using the unprocessed url in that case
    }
    this.setTitle(title);
  },

  async setTitleUsingMetadata(pdfDocument) {
    const data = await pdfDocument.getMetadata();
    const info = data.info,
      metadata = data.metadata;
    this.documentInfo = info;
    this.metadata = metadata;

    // Provides some basic debug information
    console.log(
      "PDF " +
        pdfDocument.fingerprints[0] +
        " [" +
        info.PDFFormatVersion +
        " " +
        (info.Producer || "-").trim() +
        " / " +
        (info.Creator || "-").trim() +
        "]" +
        " (PDF.js: " +
        (pdfjsLib.version || "-") +
        ")"
    );

    let pdfTitle;
    if (metadata && metadata.has("dc:title")) {
      const title = metadata.get("dc:title");
      // Ghostscript sometimes returns 'Untitled', so prevent setting the
      // title to 'Untitled.
      if (title !== "Untitled") {
        pdfTitle = title;
      }
    }

    if (!pdfTitle && info && info.Title) {
      pdfTitle = info.Title;
    }

    if (pdfTitle) {
      this.setTitle(pdfTitle + " - " + document.title);
    }
  },

  setTitle: function pdfViewSetTitle(title) {
    document.title = title;
  },

  error: async function pdfViewError(message, moreInfo) {
    const l10n = this.l10n;
    const moreInfoText = [
      l10n.get(
        "error_version_info",
        { version: pdfjsLib.version || "?", build: pdfjsLib.build || "?" },
        "PDF.js v{{version}} (build: {{build}})"
      ),
    ];

    if (moreInfo) {
      moreInfoText.push(
        l10n.get(
          "error_message",
          { message: moreInfo.message },
          "Message: {{message}}"
        )
      );
      if (moreInfo.stack) {
        moreInfoText.push(
          l10n.get("error_stack", { stack: moreInfo.stack }, "Stack: {{stack}}")
        );
      } else {
        if (moreInfo.filename) {
          moreInfoText.push(
            l10n.get(
              "error_file",
              { file: moreInfo.filename },
              "File: {{file}}"
            )
          );
        }
        if (moreInfo.lineNumber) {
          moreInfoText.push(
            l10n.get(
              "error_line",
              { line: moreInfo.lineNumber },
              "Line: {{line}}"
            )
          );
        }
      }
    }

    const errorWrapper = document.getElementById("errorWrapper");
    errorWrapper.hidden = false;

    const errorMessage = document.getElementById("errorMessage");
    errorMessage.textContent = message;

    const closeButton = document.getElementById("errorClose");
    closeButton.onclick = function () {
      errorWrapper.hidden = true;
    };

    const errorMoreInfo = document.getElementById("errorMoreInfo");
    const moreInfoButton = document.getElementById("errorShowMore");
    const lessInfoButton = document.getElementById("errorShowLess");
    moreInfoButton.onclick = function () {
      errorMoreInfo.hidden = false;
      moreInfoButton.hidden = true;
      lessInfoButton.hidden = false;
      errorMoreInfo.style.height = errorMoreInfo.scrollHeight + "px";
    };
    lessInfoButton.onclick = function () {
      errorMoreInfo.hidden = true;
      moreInfoButton.hidden = false;
      lessInfoButton.hidden = true;
    };
    moreInfoButton.hidden = false;
    lessInfoButton.hidden = true;
    const parts = await Promise.all(moreInfoText);
    errorMoreInfo.value = parts.join("\n");
  },

  progress: function pdfViewProgress(level) {
    const percent = Math.round(level * 100);
    // Updating the bar if value increases.
    if (percent > this.loadingBar.percent || isNaN(percent)) {
      this.loadingBar.percent = percent;
    }
  },

  get pagesCount() {
    return this.pdfDocument.numPages;
  },

  get page() {
    return this.pdfViewer.currentPageNumber;
  },

  set page(val) {
    this.pdfViewer.currentPageNumber = val;
  },

  zoomIn: function pdfViewZoomIn(ticks) {
    let newScale = this.pdfViewer.currentScale;
    do {
      newScale = (newScale * DEFAULT_SCALE_DELTA).toFixed(2);
      newScale = Math.ceil(newScale * 10) / 10;
      newScale = Math.min(MAX_SCALE, newScale);
    } while (--ticks && newScale < MAX_SCALE);
    this.pdfViewer.currentScaleValue = newScale;
  },

  zoomOut: function pdfViewZoomOut(ticks) {
    let newScale = this.pdfViewer.currentScale;
    do {
      newScale = (newScale / DEFAULT_SCALE_DELTA).toFixed(2);
      newScale = Math.floor(newScale * 10) / 10;
      newScale = Math.max(MIN_SCALE, newScale);
    } while (--ticks && newScale > MIN_SCALE);
    this.pdfViewer.currentScaleValue = newScale;
  },
  
  download: function downloadPdf() {
    window.top.open(this.url);
  },

  showDownloadPopup(show = true) {
    document.querySelector(selectors.downloadPopup).hidden = !show;
  },

  closeDownloadPopup: function closeDownloadPopup() {
    this.showDownloadPopup(false);
  },

  initUI: function pdfViewInitUI() {
    const eventBus = new pdfjsViewer.EventBus();
    this.eventBus = eventBus;

    const linkService = new pdfjsViewer.PDFLinkService({
      eventBus,
    });
    this.pdfLinkService = linkService;

    const container = document.getElementById("viewerContainer");
    const pdfViewer = new pdfjsViewer.PDFViewer({
      container,
      eventBus,
      linkService,
      l10n: this.l10n,
      textLayerMode: TEXT_LAYER_MODE,
    });
    this.pdfViewer = pdfViewer;
    linkService.setViewer(pdfViewer);

    this.pdfHistory = new pdfjsViewer.PDFHistory({
      eventBus,
      linkService,
    });
    linkService.setHistory(this.pdfHistory);

    document.getElementById("previous").addEventListener("click", function () {
      PDFViewerApplication.page--;
    });

    document.getElementById("next").addEventListener("click", function () {
      PDFViewerApplication.page++;
    });

    document.getElementById("zoomIn").addEventListener("click", function () {
      PDFViewerApplication.zoomIn();
    });

    document.getElementById("zoomOut").addEventListener("click", function () {
      PDFViewerApplication.zoomOut();
    });

    const downloadButtons = document.querySelectorAll('[data-action="download"]');
    downloadButtons.forEach(downloadBtn => downloadBtn.addEventListener("click", function () {
      PDFViewerApplication.download();
    }));

    document.querySelector('[data-action="close-popup"]').addEventListener("click", function () {
      PDFViewerApplication.closeDownloadPopup();
    });

    document
      .getElementById("pageNumber")
      .addEventListener("click", function () {
        this.select();
      });

    document
      .getElementById("pageNumber")
      .addEventListener("change", function () {
        PDFViewerApplication.page = this.value | 0;

        // Ensure that the page number input displays the correct value,
        // even if the value entered by the user was invalid
        // (e.g. a floating point number).
        if (this.value !== PDFViewerApplication.page.toString()) {
          this.value = PDFViewerApplication.page;
        }
      });

    eventBus.on("pagesinit", function () {
      // We can use pdfViewer now, e.g. let's change default scale.
      pdfViewer.currentScaleValue = DEFAULT_SCALE_VALUE;
    });

    eventBus.on(
      "pagechanging",
      function (evt) {
        const page = evt.pageNumber;
        const numPages = PDFViewerApplication.pagesCount;

        document.getElementById("pageNumber").value = page;
        document.getElementById("previous").disabled = page <= 1;
        document.getElementById("next").disabled = page >= numPages;
      },
      true
    );
  },
};

window.PDFViewerApplication = PDFViewerApplication;

document.addEventListener(
  "DOMContentLoaded",
  function () {
    PDFViewerApplication.initUI();
  },
  true
);

// The offsetParent is not set until the PDF.js iframe or object is visible;
// waiting for first animation.
const animationStarted = new Promise(function (resolve) {
  window.requestAnimationFrame(resolve);
});

// We need to delay opening until all HTML is loaded.
animationStarted.then(function () {

  PDFViewerApplication.init({
    url: params.url || DEFAULT_URL,
    showDownloadPopup: params.popup !== 'false',
    lang: params.lang || navigator.language.split('-')[0]
  });
});

let pinchZoomEnabled = false;
function enablePinchZoom(pdfViewer) {
    let startX = 0,
        startY = 0;
    let initialPinchDistance = 0;
    let pinchScale = 1;
    const viewer = document.getElementById("viewer");
    const container = document.getElementById("viewerContainer");
    const reset = () => {
        startX = startY = initialPinchDistance = 0;
        pinchScale = 1;
    };
    // Prevent native iOS page zoom
    //document.addEventListener("touchmove", (e) => { if (e.scale !== 1) { e.preventDefault(); } }, { passive: false });
    document.addEventListener("touchstart", (e) => {
        if (e.touches.length > 1) {
            startX = (e.touches[0].pageX + e.touches[1].pageX) / 2;
            startY = (e.touches[0].pageY + e.touches[1].pageY) / 2;
            initialPinchDistance = Math.hypot(
                e.touches[1].pageX - e.touches[0].pageX,
                e.touches[1].pageY - e.touches[0].pageY
            );
        } else {
            initialPinchDistance = 0;
        }
    });
    document.addEventListener(
        "touchmove",
        (e) => {
            if (initialPinchDistance <= 0 || e.touches.length < 2) {
                return;
            }
            if (e.scale !== 1) {
                e.preventDefault();
            }
            const pinchDistance = Math.hypot(
                e.touches[1].pageX - e.touches[0].pageX,
                e.touches[1].pageY - e.touches[0].pageY
            );
            const originX = startX + container.scrollLeft;
            const originY = startY + container.scrollTop;
            pinchScale = pinchDistance / initialPinchDistance;
            viewer.style.transform = `scale(${pinchScale})`;
            viewer.style.transformOrigin = `${originX}px ${originY}px`;
        },
        { passive: false }
    );
    document.addEventListener("touchend", (e) => {
        if (initialPinchDistance <= 0) {
            return;
        }
        viewer.style.transform = `none`;
        viewer.style.transformOrigin = `unset`;
        PDFViewerApplication.pdfViewer.currentScale *= pinchScale;
        const rect = container.getBoundingClientRect();
        const dx = startX - rect.left;
        const dy = startY - rect.top;
        container.scrollLeft += dx * (pinchScale - 1);
        container.scrollTop += dy * (pinchScale - 1);
        reset();
    });
}
document.addEventListener("DOMContentLoaded", () => {
    if (!pinchZoomEnabled) {
        pinchZoomEnabled = true;
        enablePinchZoom();
    }
});
