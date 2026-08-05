import { NextResponse } from 'next/server'
import { loadMemberProduct } from '@/lib/members/access'
import { CORRETOR_NOTA_8_BOOK_HTML } from './corretorNota8BookHtml'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = {
  params: Promise<{ slug: string }>
}

const BOOK_HTML: Record<string, string> = {
  'corretor-nota-8': CORRETOR_NOTA_8_BOOK_HTML,
}

const DESKTOP_READER_FIT_PATCH = `
<style>
@media (min-width:801px){
  .stage{padding:14px clamp(16px,3vw,48px)!important;overflow:hidden!important}
  .spread{max-width:100%!important;max-height:100%!important}
  .edge-prev{left:10px!important}
  .edge-next{right:10px!important}
}
</style>
<script>
(function(){
  const stage = document.querySelector('.stage');
  const spread = document.querySelector('.spread');
  if (!stage || !spread) return;

  function fitBookToViewport(){
    if (window.innerWidth <= 800) {
      spread.style.width = '';
      spread.style.height = '';
    } else {
      const aspect = 1632 / 1056;
      const styles = window.getComputedStyle(stage);
      const horizontalPadding = parseFloat(styles.paddingLeft || '0') + parseFloat(styles.paddingRight || '0');
      const verticalPadding = parseFloat(styles.paddingTop || '0') + parseFloat(styles.paddingBottom || '0');
      const availableWidth = Math.max(320, stage.clientWidth - horizontalPadding);
      const availableHeight = Math.max(260, stage.clientHeight - verticalPadding);
      const fittedHeight = Math.max(260, Math.min(availableHeight, availableWidth / aspect));

      spread.style.width = Math.floor(fittedHeight * aspect) + 'px';
      spread.style.height = Math.floor(fittedHeight) + 'px';
    }

    document.querySelectorAll('.page-slot').forEach((slot) => {
      const canvas = slot.querySelector('.page-canvas');
      if (!canvas) return;
      const scale = Math.min(slot.clientWidth / 816, slot.clientHeight / 1056);
      canvas.style.setProperty('--page-scale', String(scale));
    });
  }

  window.addEventListener('load', fitBookToViewport);
  window.addEventListener('resize', fitBookToViewport);
  if ('ResizeObserver' in window) {
    new ResizeObserver(fitBookToViewport).observe(stage);
  }
  requestAnimationFrame(fitBookToViewport);
  setTimeout(fitBookToViewport, 80);
})();
</script>
`

function fitDesktopReader(html: string) {
  return html.replace('</body>', `${DESKTOP_READER_FIT_PATCH}</body>`)
}

function accessState(title: string, message: string, status: number) {
  return new NextResponse(
    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:#020607;color:#fff;font-family:Arial,sans-serif}main{max-width:520px;text-align:center}h1{font-family:Georgia,serif;color:#e8b049}p{line-height:1.6;color:rgba(255,255,255,.72)}a{color:#e8b049}</style></head><body><main><h1>${title}</h1><p>${message}</p><p><a href="/membros">Voltar para a area de membros</a></p></main></body></html>`,
    {
      status,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'private, no-store',
      },
    }
  )
}

export async function GET(_request: Request, context: RouteContext) {
  const { slug } = await context.params
  const html = BOOK_HTML[slug]

  if (!html) {
    return accessState('Livro nao encontrado', 'Este material nao esta disponivel na biblioteca.', 404)
  }

  const { user, member, product, entitlement, adminPreview } = await loadMemberProduct(slug)

  if (!user) {
    return accessState('Login necessario', 'Entre com o e-mail usado na compra para abrir este livro.', 401)
  }

  if ((!adminPreview && (!member || member.status !== 'active')) || !product || !entitlement) {
    return accessState('Acesso nao liberado', 'Este produto ainda nao esta liberado para esta conta.', 403)
  }

  return new NextResponse(fitDesktopReader(html), {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, no-store',
      'Referrer-Policy': 'same-origin',
      'X-Frame-Options': 'SAMEORIGIN',
    },
  })
}
