import {
  sampleRUM,
  buildBlock,
  loadHeader,
  loadFooter,
  decorateButtons,
  decorateIcons,
  decorateSections,
  decorateBlock,
  decorateBlocks,
  decorateTemplateAndTheme,
  waitForLCP,
  loadBlocks,
  loadCSS,
} from './lib-franklin.js';

const LCP_BLOCKS = []; // add your LCP blocks to the list

/**
 * Builds hero block and prepends to main in a new section.
 * @param {Element} main The container element
 */
function buildHeroBlock(main) {
  const h1 = main.querySelector('h1');
  const picture = main.querySelector('picture');
  // eslint-disable-next-line no-bitwise
  if (h1 && picture && (h1.compareDocumentPosition(picture) & Node.DOCUMENT_POSITION_PRECEDING)) {
    const section = document.createElement('div');
    section.append(buildBlock('hero', { elems: [picture, h1] }));
    main.prepend(section);
  }
}

/**
 * load fonts.css and set a session storage flag
 */
async function loadFonts() {
  await loadCSS(`${window.hlx.codeBasePath}/styles/fonts.css`);
  try {
    if (!window.location.hostname.includes('localhost')) sessionStorage.setItem('fonts-loaded', 'true');
  } catch (e) {
    // do nothing
  }
}

/**
 * Builds all synthetic blocks in a container element.
 * @param {Element} main The container element
 */
function buildAutoBlocks(main) {
  try {
    buildHeroBlock(main);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Auto Blocking failed', error);
  }
}

/**
 * Decorates the main element.
 * @param {Element} main The main element
 */
// eslint-disable-next-line import/prefer-default-export
export function decorateMain(main) {
  // hopefully forward compatible button decoration
  decorateButtons(main);
  decorateIcons(main);
  buildAutoBlocks(main);
  decorateSections(main);
  decorateBlocks(main);
}

/**
 * Loads everything needed to get to LCP.
 * @param {Element} doc The container element
 */
async function loadEager(doc) {
  document.documentElement.lang = 'en';
  decorateTemplateAndTheme();
  const main = doc.querySelector('main');
  if (main) {
    decorateMain(main);
    document.body.classList.add('appear');
    await waitForLCP(LCP_BLOCKS);
  }

  try {
    /* if desktop (proxy for fast connection) or fonts already loaded, load fonts.css */
    if (window.innerWidth >= 900 || sessionStorage.getItem('fonts-loaded')) {
      loadFonts();
    }
  } catch (e) {
    // do nothing
  }
}

/**
 * Loads everything that doesn't need to be delayed.
 * @param {Element} doc The container element
 */
async function loadLazy(doc) {
  const main = doc.querySelector('main');
  await loadBlocks(main);

  const { hash } = window.location;
  const element = hash ? doc.getElementById(hash.substring(1)) : false;
  if (hash && element) element.scrollIntoView();

  loadHeader(doc.querySelector('header'));
  loadFooter(doc.querySelector('footer'));

  loadCSS(`${window.hlx.codeBasePath}/styles/lazy-styles.css`);
  loadFonts();

  sampleRUM('lazy');
  sampleRUM.observe(main.querySelectorAll('div[data-block-name]'));
  sampleRUM.observe(main.querySelectorAll('picture > img'));
}

/* START lib-franklin overrides/extensionts */
/**
 * Returns a picture element with webp and fallbacks
 * @param {string} src The image URL
 * @param {boolean} eager load image eager
 * @param {Array} breakpoints breakpoints and corresponding params (eg. width)
 */

function buildSrcSet(dimensions, path, format, optimize = 'medium') {
  let srcset = '';
  dimensions.forEach((dim, i) => {
    if (i > 0) {
      srcset += ', ';
    }
    srcset += `${path}?width=${dim.width}&format=${format}&optimize=${optimize}`;
    if (dim.density) {
      srcset += ` ${dim.density}`;
    }
  });
  return srcset;
}

export function createOptimizedPicture(src, alt = '', eager = false, breakpoints = [{ media: '(min-width: 400px)', dimensions: [{ width: '2000' }] }, { dimensions: [{ width: '750' }] }], optimize = 'medium') {
  const url = new URL(src, window.location.href);
  const picture = document.createElement('picture');
  const { pathname } = url;
  const ext = pathname.substring(pathname.lastIndexOf('.') + 1);

  // webp
  breakpoints.forEach((br) => {
    const { media, dimensions } = br;
    const source = document.createElement('source');
    if (br.media) source.setAttribute('media', media);
    source.setAttribute('type', 'image/webp');
    const srcset = buildSrcSet(dimensions, pathname, 'webply', optimize);
    source.setAttribute('srcset', srcset);
    picture.appendChild(source);
  });

  // fallback
  breakpoints.forEach((br, i) => {
    const { media, dimensions } = br;
    if (i < breakpoints.length - 1) {
      const source = document.createElement('source');
      if (br.media) source.setAttribute('media', media);
      const srcset = buildSrcSet(dimensions, pathname, ext, optimize);
      source.setAttribute('srcset', srcset);
      picture.appendChild(source);
    } else {
      const img = document.createElement('img');
      img.setAttribute('loading', eager ? 'eager' : 'lazy');
      img.setAttribute('alt', alt);
      picture.appendChild(img);
      img.setAttribute('src', `${pathname}?width=${dimensions[0].width}&format=${ext}&optimize=${optimize}`);
    }
  });

  return picture;
}

/*
 * If a block contains a link that can be an embed (optionally with image preview)
 * then prepare the necessary block for the embed and add to the provided subblock array
 * @param {*} elem element to investigate for embed content
 * @returns block if embed was detected otherwise false
 */

export function processEmbed(elem) {
  // setup embed
  const link = elem.querySelector('a');

  if (!link) {
    return false;
  }
  const linkWrapper = link?.closest('div');
  let hasImg = false;
  const img = elem.querySelector('picture');
  if (img) {
    hasImg = true;
  }
  if (!linkWrapper || linkWrapper.children.length !== (hasImg ? 2 : 1)) {
    return false;
  }
  const sourceOrImg = hasImg ? img : 'Source';
  const linkUrl = new URL(link.href);
  let linkTextUrl;
  try {
    linkTextUrl = new URL(link.textContent);
  } catch {
    // not a url, ignore
  }
  if (!linkTextUrl || linkTextUrl.pathname !== linkUrl.pathname) {
    return false;
  }
  const fragmentDomains = ['localhost', 'surest.com', 'my-website--zhoux135.hlx.page', 'my-website--zhoux135.hlx.live'];
  const found = fragmentDomains.find((domain) => linkUrl.hostname.endsWith(domain));
  let block;
  if (found) {
    // fragment or video
    if (linkUrl.pathname.includes('.mp4')) {
      // video
      block = buildBlock('video', [[sourceOrImg, link]]);
      linkWrapper.append(block);
      linkWrapper.classList.add('media-col');
      decorateBlock(block);
    } else {
      // fragment
      block = buildBlock('fragment', [[sourceOrImg, link]]);
      linkWrapper.append(block);
      decorateBlock(block);
    }
  } else {
    block = buildBlock('embed', [[sourceOrImg, link]]);
    linkWrapper.append(block);
    linkWrapper.classList.add('media-col');
    decorateBlock(block);
  }
  return block;
}

/**
 * Loads everything that happens a lot later,
 * without impacting the user experience.
 */
function loadDelayed() {
  // eslint-disable-next-line import/no-cycle
  window.setTimeout(() => import('./delayed.js'), 3000);
  // load anything that can be postponed to the latest here
}

async function loadPage() {
  await loadEager(document);
  await loadLazy(document);
  loadDelayed();
}

loadPage();
