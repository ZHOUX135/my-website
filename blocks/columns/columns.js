import { loadBlock } from '../../scripts/lib-franklin.js';
import { createOptimizedPicture, processEmbed } from '../../scripts/scripts.js';

function replacePicture(pic) {
  const img = pic.querySelector('img');
  const { src } = img;
  const imgUrl = new URL(src);
  const newPic = createOptimizedPicture(imgUrl.pathname, img.alt, false, [
    {
      media: '(min-width: 900px)',
      dimensions: [
        {
          width: '1400',
          density: '1x',
        },
        {
          width: '2800',
          density: '2x',
        },
      ],
    },
    {
      dimensions: [
        {
          width: '700',
          density: '1x',
        },
        {
          width: '1400',
          density: '2x',
        },
      ],
    },
  ]);
  pic.replaceWith(newPic);
}

export default async function decorate(block) {
  const cols = [...block.firstElementChild.children];
  block.classList.add(`columns-${cols.length}-cols`);

  if (block.classList.contains('split-highlight')) {
    block.closest('.section').classList.add('split-highlight-columns-container');
  }

  const subBlocks = [];
  [...block.children].forEach((row) => {
    [...row.children].forEach((col, i) => {
      const embedBlock = processEmbed(col, subBlocks);
      if (embedBlock) {
        subBlocks.push(embedBlock);
      } else {
        // setup image columns
        const pic = col.querySelector('picture');
        if (pic) {
          const picWrapper = pic.closest('div');
          if (picWrapper) {
            const allPics = picWrapper.querySelectorAll('picture');
            const allDirectPics = picWrapper.querySelectorAll(':scope > picture');
            if (picWrapper.children.length === 1 || picWrapper.children.length === allPics.length) {
              // picture is only content in column
              picWrapper.classList.add('media-col');
              let colImgClass = 'image-left';
              if (i === 1) colImgClass = 'image-right';
              if (!block.classList.contains('icons')) {
                block.classList.add('image-columns', colImgClass);
              }

              if (allPics.length > 1) {
                picWrapper.classList.add('multi-image');
              }
              if (allDirectPics.length === picWrapper.children.length) {
                picWrapper.classList.add('inline-images');
              }
            }
            allPics.forEach((pict) => replacePicture(pict));
          }
        }
      }
    });
  });

  for (let i = 0; i < subBlocks.length; i += 1) {
    const sb = subBlocks[i];
    // eslint-disable-next-line no-await-in-loop
    await loadBlock(sb);
  }
}
