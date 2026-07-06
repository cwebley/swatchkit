// SwatchKit navigation script
//
// Powers the View Transitions API cross-page morph between the SwatchKit
// main UI page and a swatch's full-screen preview page.
//
// During pageswap (main -> preview): the iframe carrying the swatch is
// tagged with view-transition-name: "preview" so the browser morphs the
// iframe content into the preview page body.
//
// During pagereveal (preview -> main): the same name is set on the
// destination iframe so the reverse morph pairs up.

function parsePreviewTarget(url) {
  const match = url.pathname.match(/\/preview\/([^/]+)\/([^/]+)\/?$/);
  if (!match) return { isPreview: false, slug: null };
  return { isPreview: true, slug: match[2] };
}

window.addEventListener("pageswap", (e) => {
  if (!e.viewTransition) return;
  const targetUrl = new URL(e.activation.entry.url);
  const { isPreview, slug } = parsePreviewTarget(targetUrl);
  if (!isPreview) return;

  const iframe = document.querySelector(`#${slug} iframe`);
  if (!iframe) return;

  iframe.style.viewTransitionName = "preview";
  e.viewTransition.finished.then(() => {
    iframe.style.viewTransitionName = "none";
  });
});

window.addEventListener("pagereveal", async (event) => {
  if (!event.viewTransition) return;
  const fromUrl = event.activation?.from?.url
    ? new URL(event.activation.from.url)
    : null;
  if (!fromUrl) return;

  const { isPreview, slug } = parsePreviewTarget(fromUrl);
  if (!isPreview) return;

  const iframe = document.querySelector(`#${slug} iframe`);
  if (!iframe) return;

  iframe.style.viewTransitionName = "preview";
  await event.viewTransition.ready;
  iframe.style.viewTransitionName = "none";
});