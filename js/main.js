// @ts-check
/// <reference path="bbqr.d.ts" />

(async function () {
  /** @typedef {{qrParts: string[]; rawBytes: Uint8Array; encoding: '2' | 'Z'; fileType: 'S' | 'R' | 'E'; qrVersion: number}} QRInfo */

  /** @typedef {{ status: 'loading' }}  LoadingState */
  /** @typedef {{ status: 'invalid-hash' }} InvalidHashState */
  /** @typedef {{ status: 'no-hash' }} NoHashState */
  /** @typedef {{ status: 'loaded'; qrInfo: QRInfo }} LoadedState */

  /** @typedef {(LoadingState | InvalidHashState | NoHashState | LoadedState)}  PageState*/

  /**
   * @template {any} T
   * @param {T} el
   */
  function mustExist(el) {
    if (el === null || el === undefined) {
      alert('Missing HTML element(s) on page');
      throw new Error();
    }
    return el;
  }

  const spinnerEl = mustExist(document.querySelector('.spinner'));
  const infoEl = mustExist(document.querySelector('.info'));
  const errorEl = mustExist(document.querySelector('.error'));
  const qrCodeEl = mustExist(document.querySelector('.qr-code'));
  const qrActionButtonsEl = mustExist(document.querySelector('.qr-action-buttons'));
  const copyToastEl = mustExist(document.querySelector('.copy-toast'));
  const countControlsEl = mustExist(document.querySelector('.count-controls'));
  // const countInputEl = /** @type {HTMLInputElement} */ (
  //   mustExist(document.querySelector('.qr-count-input'))
  // );

  const DATA_REGEX = /^B\$[2Z][SRE][0-9A-Z]{2}[0-9A-Z]{2}[2-7A-Z]+$/;

  const { getState, setState } = (function () {
    /** @type {PageState} */
    let _state = { status: 'loading' };

    /**
     * @param {PageState} newState
     */
    async function setState(newState) {
      const currentImg = qrCodeEl.querySelector('img');
      if (currentImg) {
        URL.revokeObjectURL(currentImg.src);
        currentImg.remove();
      }
      switch (newState.status) {
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
        case 'loaded':
          const imgBuf = await BBQr.renderQRImage(
            newState.qrInfo.qrParts,
            newState.qrInfo.qrVersion,
            {
              renderOptions: {
                scale: 8,
              },
            }
          );

          const imgUrl = URL.createObjectURL(new Blob([imgBuf], { type: 'image/png' }));

          spinnerEl.classList.add('hidden');
          infoEl.classList.add('hidden');
          errorEl.classList.add('hidden');

          if (newState.qrInfo.rawBytes.length < 200) {
            countControlsEl.classList.add('hidden');
          } else {
            countControlsEl.classList.remove('hidden');
          }

          if (newState.qrInfo.qrParts.length === 1) {
            countControlsEl
              .querySelector('[data-action="no-animation"]')
              ?.setAttribute('disabled', '');
            countControlsEl
              .querySelector('[data-action="less-frames"]')
              ?.setAttribute('disabled', '');
            countControlsEl
              .querySelector('[data-action="more-frames"]')
              ?.removeAttribute('disabled');
          } else {
            countControlsEl
              .querySelector('[data-action="no-animation"]')
              ?.removeAttribute('disabled');
            countControlsEl
              .querySelector('[data-action="less-frames"]')
              ?.removeAttribute('disabled');
            countControlsEl
              .querySelector('[data-action="more-frames"]')
              ?.removeAttribute('disabled');
          }

          qrCodeEl.classList.remove('hidden');
          qrActionButtonsEl.classList.remove('hidden');
          qrCodeEl.innerHTML = `<img src="${imgUrl}" alt="BBQr code">`;

          break;
        default:
          /** @type {never} */
          const _exhaustiveCheck = newState;
      }
      _state = newState;
      console.debug('setState', newState);
    }

    return {
      getState: () => _state,
      setState,
    };
  })();

  async function downloadQR() {
    const state = getState();

    if (state.status !== 'loaded') {
      console.warn('downloadQR called but state is not loaded');
      return;
    }

    const imgEl = qrCodeEl.querySelector('img');
    if (!imgEl) return;
    const url = imgEl.src;
    const a = document.createElement('a');
    a.href = url;

    // make the filename KT_<type>_<16 random hex bytes>.png
    let filename = `KT_${state.qrInfo.fileType}_`;

    const hash = await crypto.subtle.digest('SHA-256', state.qrInfo.rawBytes);
    const hashBytes = new Uint8Array(hash);
    const lastBytes = hashBytes.slice(-16);
    filename += Array.from(lastBytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    filename += `_${state.qrInfo.qrParts.length}x`;

    filename += '.png';

    a.download = filename;
    a.click();
    a.remove();
  }

  async function loadDataFromUrl() {
    const data = window.location.hash ? window.location.hash.slice(1) : null;

    if (!data) {
      setState({ status: 'no-hash' });
      return;
    }

    if (!DATA_REGEX.test(data)) {
      setState({ status: 'invalid-hash' });
      return;
    }

    const header = data.slice(0, 8);

    // validated by regex above
    const encoding = /** @type {('2' | 'Z')} */ (header[2]);
    const fileType = /** @type {('S' | 'R' | 'E')} */ (header[3]);

    const { version } = BBQr.findBestVersion(data.slice(8).length, 8, {
      encoding,
      minSplit: 1,
      maxSplit: 1,
      minVersion: 1,
      maxVersion: 40,
    });

    // "join" back to raw bytes, so we can adjust number of QRs etc.
    const { raw } = BBQr.joinQRs([data]);

    setState({
      status: 'loaded',
      qrInfo: { qrParts: [data], rawBytes: raw, encoding, fileType, qrVersion: version },
    });
  }

  /**
   * @param {'up' | 'down' | 'single'} action
   */
  async function adjustQRCount(action) {
    const state = getState();

    if (state.status !== 'loaded') {
      console.warn('increaseQRCount called but state is not loaded');
      return;
    }

    if (action === 'single') {
      const { parts, version } = BBQr.splitQRs(state.qrInfo.rawBytes, state.qrInfo.fileType, {
        encoding: state.qrInfo.encoding,
        minSplit: 1,
        maxSplit: 1,
        minVersion: 1,
        maxVersion: 40,
      });

      setState({
        status: 'loaded',
        qrInfo: { ...state.qrInfo, qrParts: parts, qrVersion: version },
      });
      return;
    }

    const currentCount = state.qrInfo.qrParts.length;

    let newCount = currentCount;

    while (newCount > 0 && newCount <= 1295) {
      newCount += action === 'up' ? 1 : -1;
      try {
        const { parts, version } = BBQr.splitQRs(state.qrInfo.rawBytes, state.qrInfo.fileType, {
          encoding: state.qrInfo.encoding,
          minSplit: newCount,
          maxSplit: newCount,
          minVersion: 1,
          maxVersion: 40,
        });

        setState({
          status: 'loaded',
          qrInfo: { ...state.qrInfo, qrParts: parts, qrVersion: version },
        });
        return;
      } catch (err) {
        console.debug(`adjustQRCount: cannot split into ${newCount} parts, skipping`);
      }
    }
  }

  loadDataFromUrl();

  window.addEventListener('hashchange', loadDataFromUrl);

  // countInputEl.addEventListener('change', (e) => {
  //   const count = parseInt(countInputEl.value);
  //   if (isNaN(count)) {
  //     console.warn('setQRCount called with invalid count', count);
  //     return;
  //   }
  //   setQRCount(count);
  // });

  document.querySelectorAll('[data-action]').forEach((el) => {
    el.addEventListener('click', (e) => {
      const action = el.getAttribute('data-action');
      if (action === 'copy-url') {
        navigator.clipboard
          .writeText(window.location.href)
          .then(() => {
            copyToastEl.innerHTML = 'URL copied to clipboard!';
          })
          .catch((err) => {
            copyToastEl.innerHTML = 'Failed to copy URL';
          })
          .finally(() => {
            copyToastEl.classList.add('show');
            setTimeout(() => {
              copyToastEl.classList.remove('show');
            }, 1500);
          });
      } else if (action === 'download-qr') {
        downloadQR();
      } else if (action === 'more-frames') {
        adjustQRCount('up');
      } else if (action === 'less-frames') {
        adjustQRCount('down');
      } else if (action === 'no-animation') {
        adjustQRCount('single');
      }
    });
  });
})();
