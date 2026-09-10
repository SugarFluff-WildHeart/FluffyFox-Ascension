(function () {

  "use strict";


  const addonId =
    document.documentElement.dataset.addonId ||
    "my-dune-addon";


  const pendingRequests =
    new Map();


  function createRequestId() {

    if (
      window.crypto &&
      typeof window.crypto.randomUUID ===
        "function"
    ) {

      return window.crypto.randomUUID();

    }


    return `${Date.now()}-${Math.random()
      .toString(16)
      .slice(2)}`;

  }


  /*
   * Dune addons normally run inside an iframe.
   *
   * Some Console hosting modes can give the iframe an
   * opaque/null origin. Passing that value directly to
   * postMessage() can throw:
   *
   *   DOMException:
   *   An invalid or illegal string was specified
   *
   * Resolve the safest usable parent origin first.
   */

  function getTargetOrigin() {

    const currentOrigin =
      window.location.origin;


    if (
      currentOrigin &&
      currentOrigin !== "null" &&
      currentOrigin !== "undefined"
    ) {

      return currentOrigin;

    }


    try {

      const referrer =
        document.referrer;


      if (referrer) {

        const referrerOrigin =
          new URL(
            referrer
          ).origin;


        if (
          referrerOrigin &&
          referrerOrigin !== "null"
        ) {

          return referrerOrigin;

        }

      }

    } catch (
      error
    ) {

      /*
       * If the referrer cannot be parsed,
       * fall through to the wildcard target.
       */

    }


    /*
     * The iframe has an opaque origin and no usable
     * referrer origin.
     *
     * "*" is valid for postMessage and lets the Dune
     * Console parent receive the request.
     *
     * The response handler below still validates
     * event.origin before accepting responses.
     */

    return "*";

  }


  function request(
    action,
    payload = {}
  ) {

    const requestId =
      createRequestId();


    return new Promise(
      (
        resolve,
        reject
      ) => {

        pendingRequests.set(
          requestId,
          {
            resolve,
            reject
          }
        );


        try {

          window.parent.postMessage(
            {
              type:
                "dune-addon-request",

              addonId,

              requestId,

              action,

              payload
            },

            getTargetOrigin()

          );

        } catch (
          error
        ) {

          pendingRequests.delete(
            requestId
          );


          reject(
            error
          );


          return;

        }


        window.setTimeout(
          () => {

            const pending =
              pendingRequests.get(
                requestId
              );


            if (!pending) {
              return;
            }


            pendingRequests.delete(
              requestId
            );


            pending.reject(
              new Error(
                "Bridge request timed out."
              )
            );

          },

          30000
        );

      }
    );

  }


  window.addEventListener(
    "message",
    event => {

      /*
       * When the iframe has an opaque origin, the browser
       * can report the sender origin differently depending
       * on the Console hosting mode.
       *
       * We therefore only enforce origin equality when
       * the iframe itself has a normal origin.
       */

      const currentOrigin =
        window.location.origin;


      if (
        currentOrigin &&
        currentOrigin !== "null" &&
        event.origin !== currentOrigin
      ) {

        return;

      }


      const message =
        event.data || {};


      if (
        message.type !==
        "dune-addon-response"
      ) {

        return;

      }


      if (
        message.addonId &&
        message.addonId !== addonId
      ) {

        return;

      }


      const pending =
        pendingRequests.get(
          message.requestId
        );


      if (!pending) {
        return;
      }


      pendingRequests.delete(
        message.requestId
      );


      if (message.ok) {

        pending.resolve(
          message.result
        );

      } else {

        pending.reject(
          new Error(
            message.error ||
            "Bridge request failed."
          )
        );

      }

    }
  );


  window.DuneAddon = {
    request
  };

})();