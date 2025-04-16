// @ts-check
/// <reference path="bbqr.d.ts" />

(async function () {
  /** @typedef {{qrParts: string[]; rawBytes: Uint8Array; encoding: '2' | 'Z'; fileType: 'S' | 'R' | 'E'; qrVersion: number; minCount: number;}} QRInfo */

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

  const DATA_REGEX = /^B\$[2Z][SRE][0-9A-Z]{2}[0-9A-Z]{2}[2-7A-Z]+$/;

  const { getState, setState } = (function () {
    /** @type {PageState} */
    let _state = { status: 'loading' };

    /**
     * @param {PageState} newState
     */
    async function setState(newState) {
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
          infoEl.classList.add('hidden');
          errorEl.classList.add('hidden');
          spinnerEl.classList.remove('hidden');
          spinnerEl.classList.add('absolute');

          qrCodeEl.classList.add('invisible');

          const [animatedImgBuf, stackedImgBuf] = await Promise.all([
            BBQr.renderQRImage(newState.qrInfo.qrParts, newState.qrInfo.qrVersion, {
              scale: 16,
              margin: '12.5%',
            }),
            BBQr.renderQRImage(newState.qrInfo.qrParts, newState.qrInfo.qrVersion, {
              mode: 'stacked',
              scale: 16,
              margin: '12.5%',
            }),
          ]);

          const animatedImgUrl = URL.createObjectURL(
            new Blob([animatedImgBuf], { type: 'image/png' })
          );
          const stackedImgUrl = URL.createObjectURL(
            new Blob([stackedImgBuf], { type: 'image/png' })
          );

          spinnerEl.classList.add('hidden');
          spinnerEl.classList.remove('absolute');

          if (newState.qrInfo.rawBytes.length < 200) {
            document.body.classList.add('small-qr');
          } else {
            document.body.classList.remove('small-qr');
          }

          const newCount = newState.qrInfo.qrParts.length;
          const minCount = newState.qrInfo.minCount;

          if (newCount === minCount || minCount > 1) {
            countControlsEl
              .querySelector('[data-action="no-animation"]')
              ?.setAttribute('disabled', '');
          } else {
            countControlsEl
              .querySelector('[data-action="no-animation"]')
              ?.removeAttribute('disabled');
          }

          if (newCount === minCount) {
            countControlsEl
              .querySelector('[data-action="less-frames"]')
              ?.setAttribute('disabled', '');
          } else {
            countControlsEl
              .querySelector('[data-action="less-frames"]')
              ?.removeAttribute('disabled');
          }

          qrActionButtonsEl.classList.remove('hidden');
          qrCodeEl.innerHTML = `
          <img src="${animatedImgUrl}" alt="BBQr code" data-mode="animated">
          <img src="${stackedImgUrl}" alt="BBQr stacked code" data-mode="stacked" style="display: none;">
          `;

          qrCodeEl.classList.remove('hidden');
          qrCodeEl.classList.remove('invisible');

          if (newState.qrInfo.qrParts.length > 1) {
            document.body.classList.add('multi-qr');
          } else {
            document.body.classList.remove('multi-qr');
          }

          break;
        default:
          /** @type {never} */
          const _exhaustiveCheck = newState;
      }
      _state = newState;
    }

    return {
      getState: () => _state,
      setState,
    };
  })();

  async function downloadQR(stacked = false) {
    const state = getState();

    if (state.status !== 'loaded') {
      console.warn('downloadQR called but state is not loaded');
      return;
    }

    const imgEl = stacked
      ? qrCodeEl.querySelector('img[data-mode="stacked"]')
      : qrCodeEl.querySelector('img[data-mode="animated"]');

    if (!(imgEl instanceof HTMLImageElement)) return;
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

    if (state.qrInfo.qrParts.length > 1) {
      filename += `_${state.qrInfo.qrParts.length}x`;

      filename += stacked ? '_stacked' : '_animated';
    }

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

    try {
      // "join" back to raw bytes, so we can adjust number of QRs etc.
      // - also helps ensure the base32 encoded data itself is valid
      const { raw } = BBQr.joinQRs([data]);

      // - render as few QRs as possible initially
      // - might need more than one if data is large
      const { parts, version } = BBQr.splitQRs(raw, fileType, {
        encoding,
        minSplit: 1,
        maxSplit: 1295,
        minVersion: 1,
        maxVersion: 40,
      });

      setState({
        status: 'loaded',
        qrInfo: {
          qrParts: parts,
          rawBytes: raw,
          encoding,
          fileType,
          qrVersion: version,
          minCount: parts.length,
        },
      });
    } catch (err) {
      console.error(err);
      setState({ status: 'invalid-hash' });
    }
  }

  /**
   * @param {'up' | 'down' | 'single'} action
   */
  async function adjustQRCount(action) {
    const state = getState();

    if (state.status !== 'loaded') {
      console.warn('adjustQRCount called but state is not loaded');
      return;
    }

    const currentCount = state.qrInfo.qrParts.length;

    /**
     * @param {LoadedState} curState
     * @param {number} newMin
     * @param {number} newMax
     */
    function _adjust(curState, newMin, newMax) {
      const { parts, version } = BBQr.splitQRs(curState.qrInfo.rawBytes, curState.qrInfo.fileType, {
        encoding: curState.qrInfo.encoding,
        minSplit: newMin,
        maxSplit: newMax,
        minVersion: 1,
        maxVersion: 40,
      });

      setState({
        status: 'loaded',
        qrInfo: { ...curState.qrInfo, qrParts: parts, qrVersion: version },
      });
    }

    if (action === 'single') {
      if (state.qrInfo.minCount > 1) {
        console.error('adjustQRCount: tried to set single QR but minCount > 1');
        return;
      }
      _adjust(state, 1, 1);
    } else if (action === 'up') {
      try {
        _adjust(state, currentCount + 1, 1295);
      } catch (err) {
        console.warn(
          `adjustQRCount: tried to increase QR count but already at max: ${currentCount}.`
        );
        document.querySelector('[data-action="more-frames"]')?.setAttribute('disabled', '');
      }
    } else if (action === 'down') {
      let newCount = currentCount - 1;

      while (newCount >= state.qrInfo.minCount) {
        try {
          _adjust(state, newCount, newCount);
          return;
        } catch (err) {
          newCount--;
        }
      }

      console.error(
        `adjustQRCount: tried to decrease QR count but already at min: ${state.qrInfo.minCount}`
      );
    }
  }

  loadDataFromUrl();

  window.addEventListener('hashchange', loadDataFromUrl);

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
      } else if (action === 'download-qr-stacked') {
        downloadQR(true);
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
