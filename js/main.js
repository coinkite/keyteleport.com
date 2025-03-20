// @ts-check
/// <reference path="bbqr.d.ts" />

(async function () {
  /** @typedef {{ status: 'loading' }}  Loading */
  /** @typedef {{ status: 'invalid-hash' }} InvalidHash */
  /** @typedef {{ status: 'no-hash' }} NoHash */
  /** @typedef {{ status: 'qr-code', url: string, data: string }} QRCode */
  /** @typedef {(Loading | InvalidHash | NoHash | QRCode)}  PageState*/

  /**
   * @template {any} T
   * @param {T} el
   */
  function mustExist(el) {
    if (el === null || el === undefined) {
      alert('Missing HTML element(s) on page!');
      throw new Error();
    }
    return el;
  }

  const spinnerEl = mustExist(document.querySelector('.spinner'));
  const infoEl = mustExist(document.querySelector('.info'));
  const errorEl = mustExist(document.querySelector('.error'));
  const qrCodeEl = mustExist(document.querySelector('.qr-code'));
  const qrActionButtonsEl = mustExist(document.querySelector('.qr-action-buttons'));

  const DATA_REGEX = /^B\$[2Z][SRE][0-9A-Z]{2}[0-9A-Z]{2}[2-7A-Z]+$/;

  /**
   * @param {PageState} state
   */
  function updatePageState(state) {
    const currentImg = qrCodeEl.querySelector('img');

    if (currentImg) {
      URL.revokeObjectURL(currentImg.src);
      currentImg.remove();
    }

    switch (state.status) {
      case 'loading':
        spinnerEl.classList.remove('hidden');
        infoEl.classList.add('hidden');
        errorEl.classList.add('hidden');
        qrCodeEl.classList.add('hidden');
        qrActionButtonsEl.classList.add('hidden');
        break;
      case 'invalid-hash':
        spinnerEl.classList.add('hidden');
        infoEl.classList.add('hidden');
        errorEl.classList.remove('hidden');
        qrCodeEl.classList.add('hidden');
        qrActionButtonsEl.classList.add('hidden');
        break;
      case 'no-hash':
        spinnerEl.classList.add('hidden');
        infoEl.classList.remove('hidden');
        errorEl.classList.add('hidden');
        qrCodeEl.classList.add('hidden');
        qrActionButtonsEl.classList.add('hidden');
        break;
      case 'qr-code':
        spinnerEl.classList.add('hidden');
        infoEl.classList.add('hidden');
        errorEl.classList.add('hidden');
        qrCodeEl.classList.remove('hidden');
        qrActionButtonsEl.classList.remove('hidden');
        qrCodeEl.innerHTML = `<img src="${state.url}" alt="BBQr code" data-data="${state.data}" />`;

        break;
      default:
        /** @type {never} */
        const _exhaustiveCheck = state;
    }
  }

  /**
   * @param {string} data
   */
  function parseData(data) {
    if (!data || !DATA_REGEX.test(data)) throw new Error('Bad data');

    const header = data.slice(0, 8);
    const encoded = data.slice(8);

    const encoding = /** @type {('2' | 'Z')} */ (header[2]);

    const splitMod = 8;

    const { version } = BBQr.findBestVersion(encoded.length, splitMod, {
      encoding: encoding,
      minSplit: 1,
      maxSplit: 1,
      minVersion: 1,
      maxVersion: 40,
    });

    return {
      encoding,
      splitMod,
      encoded,
      qrVersion: version,
    };
  }

  function downloadQR() {
    const imgEl = qrCodeEl.querySelector('img');
    if (!imgEl) return;
    const url = imgEl.src;
    const a = document.createElement('a');
    a.href = url;
    a.download = imgEl.getAttribute('data-data') || 'qr-code.png';
    a.click();
    a.remove();
  }

  async function run() {
    const data = window.location.hash ? window.location.hash.slice(1) : null;

    if (!data) {
      updatePageState({ status: 'no-hash' });
      return;
    }

    try {
      const { qrVersion } = parseData(data);
      const imgBuf = await BBQr.renderQRImage([data], qrVersion, {
        renderOptions: {
          scale: 8,
        },
      });

      const url = URL.createObjectURL(new Blob([imgBuf], { type: 'image/png' }));

      updatePageState({ status: 'qr-code', url, data });
    } catch (err) {
      updatePageState({ status: 'invalid-hash' });
      return;
    }
  }

  run();

  window.addEventListener('hashchange', run);

  document.querySelectorAll('[data-action]').forEach((el) => {
    el.addEventListener('click', (e) => {
      console.log('clicked', el);
      const action = el.getAttribute('data-action');
      if (action === 'copy-url') {
        navigator.clipboard.writeText(window.location.href).catch((err) => {
          console.error('Failed to copy:', err);
        });
      } else if (action === 'download-qr') {
        downloadQR();
      }
    });
  });
})();
