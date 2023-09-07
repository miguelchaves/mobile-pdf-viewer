# PDF Mobile Viewer

## Información

La aplicación recibe los siguientes parámetros de entrada por query-params:
* `url` La URL absoluta del pdf a mostrar en el visor
* `lang` Idioma. Acepta el español (`es`) e inglés (`en`). Si no se le informa lo coge del navegador.
* `popup` Muestra un popup a pie de página del visor para descargar el archivo por si hubiera problemas. Si se quisiera ocultar se tendría que informar como `false`.
* `iframe`. Boolean, por defecto toma el valor `false`. Si se informa a `true` informará errores y acciones de descarga vía postMessage a `window.top`. En caso contrario, la descarga se hará con un `window.top.open()`. Los eventos son:
    * `loaded`
    * `download`
    * `error`

## Instalación

```
npm install
```

## Build / Contrucción

This project has been created using **webpack-cli**, you can now run

```
npm run build
```
## Code

Para más información, visita el repositorio de GitHub:

    https://github.com/miguelchaves/mobile-pdf-viewer



