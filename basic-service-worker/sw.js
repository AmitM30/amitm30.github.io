
var self                      = this;

var internals                 = {};
internals.LRUCache            = {};             // Object to maintain timestamp for request urls

internals.STATIC_CACHE_NAME   = 'static-v1-ngk6wva';
internals.API_CACHE_NAME      = 'api-v1-ngk6wva';
internals.SUGGEST_CACHE_NAME  = 'suggest-v1-ngk6wva';

internals.SUGGEST_CACHE_TIME  = 60 * 5 * 1000;  // in seconds
internals.API_CACHE_TIME      = 60 * 5 * 1000;  // in seconds

internals.CACHE_FILE_LIST = [
  '/fonts/proximanova-regular-webfont.woff2',
  '/styles/site.css',
  '/images/iron_man.jpg'
];

internals.CACHE_API_LIST = [
  '/'
];

internals.SUGGEST_API_LIST = [
  '/api/sawa/v1/suggest'
];

// *********************************************************************************
// *********************************************************** LOGIC TO CACHE API **
internals.cacheAPIResponse = function (request) {
  var now = (new Date()).getTime();
  var url = new URL(request.url);
  return caches.match(request).then(function(response) {
    if (response) {
      if ((now - internals.LRUCache[url.pathname + url.search]) < internals.API_CACHE_TIME) {
        return response;
      }
    }

    return fetch(request).then(function(response) {
      internals.LRUCache[url.pathname + url.search] = now;
      caches.open(internals.API_CACHE_NAME).then(function(cache) {
        cache.put(request, response);
      });

      return response.clone();
    });
  });
};

// *********************************************************************************
// *********************************************** LOGIC TO CACHE SUGGEST RESULTS **
internals.cacheSuggestResponse = function (request) {
  var now = (new Date()).getTime();
  var url = new URL(request.url);
  return caches.match(request).then(function(response) {
    if (response) {
      if ((now - internals.LRUCache[url.pathname + url.search]) < internals.SUGGEST_CACHE_TIME) {
        return response;
      }
    }

    return fetch(request).then(function(response) {
      internals.LRUCache[url.pathname + url.search] = now;
      caches.open(internals.SUGGEST_CACHE_NAME).then(function(cache) {
        cache.put(request, response);
      });

      return response.clone();
    });
  });
};

// *********************************************************************************
// ************************************************* LOGIC TO CACHE STATIC ASSETS **
internals.cacheStaticAssets = function (request) {
  return caches.match(request).then(function(response) {
    if (response && response.type !== 'opaque') { return response; }

    return fetch(request).then(function(response) {
      caches.open(internals.STATIC_CACHE_NAME).then(function(cache) {
        cache.put(request, response);
      });

      return response.clone();
    });
  });
};

// *********************************************************************************
// ************************************************************************ FETCH **
// Listen for all `fetch` event from the application
// response with cache first if in the list, else regular fetch
self.addEventListener('fetch', function(event) {
  var requestURL = new URL(event.request.url);

  if (internals.CACHE_API_LIST.indexOf(requestURL.pathname) >= 0) {
    event.respondWith(internals.cacheAPIResponse(event.request));
  } else if (internals.SUGGEST_API_LIST.indexOf(requestURL.pathname.split('?')[0]) >= 0) {
    event.respondWith(internals.cacheSuggestResponse(event.request));
  } else if (internals.CACHE_FILE_LIST.indexOf(requestURL.href) >= 0) {
    event.respondWith(internals.cacheStaticAssets(event.request));
  }
  else {
    event.respondWith(fetch(event.request));
  }
});

// *********************************************************************************
// ********************************************************************** INSTALL **
// Place to instantiate the SW with pre-cached list of assets / endpoints
self.addEventListener('install', function(event) {
  event.waitUntil(
    Promise.all([
      caches.open(internals.STATIC_CACHE_NAME).then(function(cache) {
        return cache.addAll(internals.CACHE_FILE_LIST);
      })
      // caches.open(internals.API_CACHE_NAME).then(function(cache) {
      //   var now = (new Date()).getTime();
      //   internals.CACHE_API_LIST.forEach(function(api) { internals.LRUCache[api] = now; }, this);
      //   return cache.addAll(internals.CACHE_API_LIST);
      // })
    ])
    .then(function () {
      // At this point everything has been cached

      // `skipWaiting()` forces the waiting ServiceWorker to become the
      // active ServiceWorker, triggering the `onactivate` event.
      // Together with `Clients.claim()` this allows a worker to take effect
      // immediately in the client(s).
      return self.skipWaiting();
    })
  );
});

// *********************************************************************************
// ********************************************************************* ACTIVATE **
// Place to clean up old version of cache
self.addEventListener('activate', function(event) {
  if (self.clients && clients.claim) {
    clients.claim();
  }

  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      Promise.all(
        [
          cacheNames.map(function(cacheName) {
            if (internals.STATIC_CACHE_NAME !== cacheName && internals.API_CACHE_NAME !== cacheName) {
              return caches.delete(cacheName);
            }
          })
        ]
      );
    })
  );
});

// TODO *****************************************
// 1. Separate cache box for assets, APIs and suggest - DONE
// 2. version the cache per deployment - DONE
// 3. Index page should not cache
// 4. API endpoint cache should expire at some time - DONE
// 5. Suggest endpoint cache should expire at session or some time - DONE
// 6. Implement - maxAgeSeconds - If network fails, serve from cache even after maxAgeSeconds
// 7. Implement - maxEntries
