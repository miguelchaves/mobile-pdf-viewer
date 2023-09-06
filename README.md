# PDF Mobile Viewer

## Información

La aplicación recibe los siguientes parámetros de entrada por query-params:
* `url` La URL absoluta del pdf a mostrar en el visor
* `lang` Idioma. Acepta el español (`es`) e inglés (`en`). Si no se le informa lo coge del navegador.
* `iframe`. Boolean, por defecto toma el valor `false`. Si se informa a `true` informará errores y acciones de descarga vía postMessage a `window.top`. En caso contrario, la descarga se hará con un `window.top.open()`. Los eventos son:
    * `loaded`
    * `download`
    * `error`

## Install

```
npm install
```

## Build

This project has been created using **webpack-cli**, you can now run

```
npm run build
```

or

```
yarn build
```




