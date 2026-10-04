/* Add a site's static build under sites/<id>/, then register it here.
   Each width is a real CSS viewport, never a stretched desktop screenshot. */
window.LUMINA_PROJECTS = [
  {
    id: 'razor',
    name: 'Razor Barbershop',
    url: 'sites/razor/index.html',
    liveUrl: 'https://barbershoprazor.com/',
    previewParam: 'lumina-preview',
    smoothTour: true,
    readySelector: 'main',
    background: '#191c1e',
    modes: {
      desktop: { width: 1440, height: 900, poster: 'assets/previews/razor-desktop.jpg' },
      // Display 820 × 1180; reserve 24px above/below the website for system UI.
      tablet: { width: 820, height: 1132, poster: 'assets/previews/razor-tablet.jpg' },
      // Display 402 × 874; reserve 62px status area and 34px home area.
      mobile: { width: 402, height: 778, poster: 'assets/previews/razor-mobile.jpg', preserveViewOnClose: true }
    }
  },
  {
    id: 'vsi',
    name: 'VSI Sports Complex',
    url: 'sites/vsi/index.html',
    liveUrl: 'https://vsiswimming.com/',
    readySelector: 'main',
    background: '#edf7fa',
    ink: '#10334b',
    colorScheme: 'light',
    hideInThumbnail: '.consent-bar',
    bookingSelector: '[data-nm-booking]',
    modes: {
      desktop: { width: 1440, height: 900, poster: 'assets/previews/vsi-desktop.jpg' },
      tablet: { width: 820, height: 1132, poster: 'assets/previews/vsi-tablet.jpg' },
      mobile: { width: 402, height: 778, poster: 'assets/previews/vsi-mobile.jpg' }
    }
  },
  {
    id: 'jtn',
    name: 'JTN Roof Systems',
    url: 'sites/jtn/index.html',
    liveUrl: 'https://jtnhouses.com/',
    readySelector: 'main',
    background: '#f3f3f0',
    ink: '#15202b',
    colorScheme: 'light',
    presentation: 'jtn-doors',
    modes: {
      desktop: { width: 1440, height: 900, poster: 'assets/previews/jtn-desktop.jpg' },
      tablet: { width: 820, height: 1132, poster: 'assets/previews/jtn-tablet.jpg' },
      mobile: { width: 402, height: 778, poster: 'assets/previews/jtn-mobile.jpg' }
    }
  },
  {
    id: 'mypizza',
    name: 'MyPizza',
    url: 'sites/mypizza/MyPizza-Red-Paper.html',
    // Public address is still a placeholder; show the working local preview.
    readySelector: 'main',
    resetSelector: '#reset-filters',
    background: '#b93024',
    ink: '#fff7e9',
    colorScheme: 'light',
    modes: {
      desktop: { width: 1440, height: 900, poster: 'assets/previews/mypizza-desktop.jpg' },
      tablet: { width: 820, height: 1132, poster: 'assets/previews/mypizza-tablet.jpg' },
      mobile: { width: 402, height: 778, poster: 'assets/previews/mypizza-mobile.jpg' }
    }
  }
];
