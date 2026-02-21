import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { handle404 } from "@/api/404-message";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [contextualMessage, setContextualMessage] = useState({ message: "404 Error. Page not Found", suggestion: null as any });

  useEffect(() => {
    const ctx = handle404(location.pathname);
    setContextualMessage({
      message: ctx.message,
      suggestion: ctx.bestMatch ? {
        path: ctx.bestMatch,
        label: ctx.bestMatch.split('/').pop() || "Related Page"
      } : null
    });

    console.error("404 Error: Not found:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="not-found-wrapper" style={{ backgroundColor: '#000', minHeight: '100vh', width: '100%' }}>
      <Helmet>
        <title>Page Not Found</title>
        <link href="https://cdn.prod.website-files.com/680244911c3d7d28354cb55b/css/superxsolid.webflow.shared.397449411.min.css" rel="stylesheet" type="text/css" />
        <link href="https://fonts.googleapis.com" rel="preconnect" />
        <link href="https://fonts.gstatic.com" rel="preconnect" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Montserrat:100,100italic,200,200italic,300,300italic,400,400italic,500,500italic,600,600italic,700,700italic,800,800italic,900,900italic" media="all" />
        <style>{`
          .not-found-wrapper {
            --portrait-aspect-ratio: 4 / 5;
            --landscape-aspect-ratio: 16 / 9;
            --square-aspect-ratio: 1 / 1;
            --site--max-width: min(var(--site--width), 100vw);
            --container--main: calc(var(--site--max-width) - var(--site--margin) * 2);
            --site--gutter-total: calc(var(--site--gutter) * (var(--site--column-count) - 1));
            --column-width--1: calc((var(--container--main) - var(--site--gutter-total)) / var(--site--column-count));
            --column-width--plus-gutter: calc(var(--column-width--1) + var(--site--gutter));
            --animation-primary: cubic-bezier(0.83, 0, 0.17, 1);
            --animation-secondary: cubic-bezier(0.16, 1, 0.3, 1);
            background-color: var(--swatch--dark, #000);
            color: var(--swatch--light, #fff);
          }

          /* General Resets for this scope */
          .not-found-wrapper * {
            vertical-align: bottom;
            box-sizing: border-box;
          }
          .not-found-wrapper h1, .not-found-wrapper p {
            font-family: inherit;
            margin: 0;
          }

          /* Grain Overlay */
          .g_grain_overlay {
            will-change: transform;
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            z-index: 100;
            pointer-events: none;
            background-image: url('https://cdn.prod.website-files.com/680244911c3d7d28354cb55b/6839aa669993efdfdc9e89d1_Noise.webp');
            background-size: 200px;
            opacity: 0.05;
          }

          @keyframes grain-animation {
            0%, 100% { transform: translate(0, 0); }
            17% { transform: translate(-5%, -10%); }
            33% { transform: translate(3%, -15%); }
            50% { transform: translate(12%, 9%); }
            67% { transform: translate(9%, 4%); }
            83% { transform: translate(-1%, 7%); }
          }
          .u-grain-animate {
            animation: grain-animation 0.5s steps(6) infinite;
          }

          /* Button and Link Hovers */
          .g_btn_svg_wrap {
            transition: translate 0.75s var(--animation-secondary), opacity 0.4s var(--animation-secondary);
          }
          .g_btn_svg_wrap.is-first, .g_btn_svg_wrap.is-second, .g_btn_svg_wrap.is-third, .g_btn_svg_wrap.is-reveal {
            opacity: 0;
          }
          @media (hover: hover) and (pointer: fine) {
            .g_btn_wrap:is(:hover, :focus-visible) .g_btn_svg_wrap.is-first,
            .g_btn_wrap:is(:hover, :focus-visible) .g_btn_svg_wrap.is-second,
            .g_btn_wrap:is(:hover, :focus-visible) .g_btn_svg_wrap.is-third {
              transition-delay: calc((4 - var(--index, 1)) * 0.052s);
              translate: 100% -100%;
              opacity: 1;
            }
            .g_btn_wrap:is(:hover, :focus-visible) .g_btn_svg_wrap.is-reveal {
              opacity: 1;
            }
            .g_btn_wrap:is(:hover, :focus-visible) .g_btn_svg_wrap.is-main {
              translate: 100% -100%;
              opacity: 0;
            }
          }
          [data-stagger-link-duplicate],
          [data-stagger-link-text] {
            transition: transform 0.75s var(--animation-secondary), filter 0.4s var(--animation-secondary);
            display: inline-block;
          }
          [data-stagger-link]:hover [data-stagger-link-text] {
            transform: translateY(-120%);
            filter: blur(3px);
          }
          [data-stagger-link]:hover [data-stagger-link-duplicate] {
            transform: translateY(0%); scale: 1;
            filter: blur(0px);
          }
        `}</style>
      </Helmet>

      <div className="g_grain_overlay u-grain-animate"></div>

      <main id="main" className="page_main">
        <section className="hero_utility-page_wrap">
          <div className="hero_utility-page_contain">
            <div data-wf--global-eyebrow--variant="base" className="g_eyebrow_wrap">
              <div className="g_eyebrow_layout">
                <div className="g_default_dot" style={{ backgroundColor: 'var(--swatch--light)' }}></div>
                <div className="g_eyebrow_text u-text-style-mono w-richtext">
                  <p>{contextualMessage.message} — 404 Error</p>
                </div>
              </div>
            </div>

            <div className="hero_utility-page_content">
              <h1 className="hero_utility-page_title u-text-style-h4 u-weight-bold" style={{ color: "var(--swatch--light, #fff)", marginBottom: "2rem" }}>
                If you’re reading this, something has gone terribly, terribly wrong.
              </h1>

              {/* Added conditional suggestion button mapping closely to original design specs */}
              {contextualMessage.suggestion && (
                <p className="mb-4 text-xs tracking-widest uppercase opacity-60">Did you mean?</p>
              )}

              <div className="flex flex-col gap-4 items-start">
                {contextualMessage.suggestion && (
                  <button
                    data-stagger-link=""
                    onClick={() => navigate(contextualMessage.suggestion?.path || "/")}
                    className="g_btn_wrap w-variant-87298d25-6b0a-b66e-1cec-66b02e9013d8 w-inline-block"
                    style={{ marginBottom: "1rem", backgroundColor: "var(--swatch--light)", color: "var(--swatch--dark)" }}
                  >
                    <div className="g_btn_text w-variant-87298d25-6b0a-b66e-1cec-66b02e9013d8">
                      <span data-stagger-link-text="" className="g_btn_span w-variant-87298d25-6b0a-b66e-1cec-66b02e9013d8">
                        {contextualMessage.suggestion.label}
                      </span>
                      <span data-stagger-link-duplicate="" className="g_btn_span w-variant-87298d25-6b0a-b66e-1cec-66b02e9013d8 is-duplicate" style={{ transform: "translateY(100%)" }}>
                        {contextualMessage.suggestion.label}
                      </span>
                    </div>
                  </button>
                )}

                <button
                  data-stagger-arrows=""
                  data-stagger-link=""
                  onClick={() => navigate('/')}
                  className="g_btn_wrap w-variant-87298d25-6b0a-b66e-1cec-66b02e9013d8 w-inline-block"
                >
                  <div className="g_btn_arrow w-variant-87298d25-6b0a-b66e-1cec-66b02e9013d8 u-grid-custom">
                    <span className="g_btn_svg_wrap is-main">
                      <svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 69 69" fill="none" className="g_btn_svg"><path d="M7.70451 67.8689C6.20136 69.377 4.53118 69.377 3.02802 67.8689L1.19082 66.0255C-0.312335 64.5173 -0.479353 62.8415 1.19082 61.3333L52.7993 10.0546C53.1333 9.71949 52.9663 9.21676 52.4653 9.21676L7.37047 9.88707C5.19925 9.88707 4.03012 8.71403 4.03012 6.53552L4.03012 3.35155C4.03012 1.17304 5.19925 -2.27266e-07 7.37047 -3.22174e-07L57.3088 -2.50505e-06C59.48 -2.59995e-06 61.9853 -2.70946e-06 63.9895 0.335157C65.4926 0.502728 66.4947 1.00546 67.1628 1.67577C67.9979 2.51366 68.4989 3.51913 68.666 5.02733C68.833 7.03825 69 9.55191 69 11.5628L69 59.49C69 61.6685 67.8309 62.8415 65.6597 62.8415L62.8203 62.8415C60.6491 62.8415 59.48 61.6685 59.48 59.49L60.1481 15.9199C60.1481 15.4171 59.647 15.2495 59.313 15.5847L7.70451 67.8689Z" fill="currentColor" className="g_btn_path"></path></svg>
                    </span>
                    <span style={{ "--index": 3 } as React.CSSProperties} className="g_btn_svg_wrap is-third w-variant-87298d25-6b0a-b66e-1cec-66b02e9013d8">
                      <svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 69 69" fill="none" className="g_btn_svg"><path d="M7.70451 67.8689C6.20136 69.377 4.53118 69.377 3.02802 67.8689L1.19082 66.0255C-0.312335 64.5173 -0.479353 62.8415 1.19082 61.3333L52.7993 10.0546C53.1333 9.71949 52.9663 9.21676 52.4653 9.21676L7.37047 9.88707C5.19925 9.88707 4.03012 8.71403 4.03012 6.53552L4.03012 3.35155C4.03012 1.17304 5.19925 -2.27266e-07 7.37047 -3.22174e-07L57.3088 -2.50505e-06C59.48 -2.59995e-06 61.9853 -2.70946e-06 63.9895 0.335157C65.4926 0.502728 66.4947 1.00546 67.1628 1.67577C67.9979 2.51366 68.4989 3.51913 68.666 5.02733C68.833 7.03825 69 9.55191 69 11.5628L69 59.49C69 61.6685 67.8309 62.8415 65.6597 62.8415L62.8203 62.8415C60.6491 62.8415 59.48 61.6685 59.48 59.49L60.1481 15.9199C60.1481 15.4171 59.647 15.2495 59.313 15.5847L7.70451 67.8689Z" fill="currentColor" className="g_btn_path"></path></svg>
                    </span>
                    <span style={{ "--index": 2 } as React.CSSProperties} className="g_btn_svg_wrap is-second w-variant-87298d25-6b0a-b66e-1cec-66b02e9013d8">
                      <svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 69 69" fill="none" className="g_btn_svg"><path d="M7.70451 67.8689C6.20136 69.377 4.53118 69.377 3.02802 67.8689L1.19082 66.0255C-0.312335 64.5173 -0.479353 62.8415 1.19082 61.3333L52.7993 10.0546C53.1333 9.71949 52.9663 9.21676 52.4653 9.21676L7.37047 9.88707C5.19925 9.88707 4.03012 8.71403 4.03012 6.53552L4.03012 3.35155C4.03012 1.17304 5.19925 -2.27266e-07 7.37047 -3.22174e-07L57.3088 -2.50505e-06C59.48 -2.59995e-06 61.9853 -2.70946e-06 63.9895 0.335157C65.4926 0.502728 66.4947 1.00546 67.1628 1.67577C67.9979 2.51366 68.4989 3.51913 68.666 5.02733C68.833 7.03825 69 9.55191 69 11.5628L69 59.49C69 61.6685 67.8309 62.8415 65.6597 62.8415L62.8203 62.8415C60.6491 62.8415 59.48 61.6685 59.48 59.49L60.1481 15.9199C60.1481 15.4171 59.647 15.2495 59.313 15.5847L7.70451 67.8689Z" fill="currentColor" className="g_btn_path"></path></svg>
                    </span>
                    <span style={{ "--index": 1 } as React.CSSProperties} className="g_btn_svg_wrap is-first w-variant-87298d25-6b0a-b66e-1cec-66b02e9013d8">
                      <svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 69 69" fill="none" className="g_btn_svg"><path d="M7.70451 67.8689C6.20136 69.377 4.53118 69.377 3.02802 67.8689L1.19082 66.0255C-0.312335 64.5173 -0.479353 62.8415 1.19082 61.3333L52.7993 10.0546C53.1333 9.71949 52.9663 9.21676 52.4653 9.21676L7.37047 9.88707C5.19925 9.88707 4.03012 8.71403 4.03012 6.53552L4.03012 3.35155C4.03012 1.17304 5.19925 -2.27266e-07 7.37047 -3.22174e-07L57.3088 -2.50505e-06C59.48 -2.59995e-06 61.9853 -2.70946e-06 63.9895 0.335157C65.4926 0.502728 66.4947 1.00546 67.1628 1.67577C67.9979 2.51366 68.4989 3.51913 68.666 5.02733C68.833 7.03825 69 9.55191 69 11.5628L69 59.49C69 61.6685 67.8309 62.8415 65.6597 62.8415L62.8203 62.8415C60.6491 62.8415 59.48 61.6685 59.48 59.49L60.1481 15.9199C60.1481 15.4171 59.647 15.2495 59.313 15.5847L7.70451 67.8689Z" fill="currentColor" className="g_btn_path"></path></svg>
                    </span>
                    <span className="g_btn_svg_wrap is-reveal w-variant-87298d25-6b0a-b66e-1cec-66b02e9013d8">
                      <svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 69 69" fill="none" className="g_btn_svg"><path d="M7.70451 67.8689C6.20136 69.377 4.53118 69.377 3.02802 67.8689L1.19082 66.0255C-0.312335 64.5173 -0.479353 62.8415 1.19082 61.3333L52.7993 10.0546C53.1333 9.71949 52.9663 9.21676 52.4653 9.21676L7.37047 9.88707C5.19925 9.88707 4.03012 8.71403 4.03012 6.53552L4.03012 3.35155C4.03012 1.17304 5.19925 -2.27266e-07 7.37047 -3.22174e-07L57.3088 -2.50505e-06C59.48 -2.59995e-06 61.9853 -2.70946e-06 63.9895 0.335157C65.4926 0.502728 66.4947 1.00546 67.1628 1.67577C67.9979 2.51366 68.4989 3.51913 68.666 5.02733C68.833 7.03825 69 9.55191 69 11.5628L69 59.49C69 61.6685 67.8309 62.8415 65.6597 62.8415L62.8203 62.8415C60.6491 62.8415 59.48 61.6685 59.48 59.49L60.1481 15.9199C60.1481 15.4171 59.647 15.2495 59.313 15.5847L7.70451 67.8689Z" fill="currentColor" className="g_btn_path"></path></svg>
                    </span>
                  </div>
                  <div className="g_btn_text w-variant-87298d25-6b0a-b66e-1cec-66b02e9013d8">
                    <span data-stagger-link-text="" className="g_btn_span w-variant-87298d25-6b0a-b66e-1cec-66b02e9013d8">Return home</span>
                    <span data-stagger-link-duplicate="" className="g_btn_span w-variant-87298d25-6b0a-b66e-1cec-66b02e9013d8 is-duplicate" style={{ transform: "translateY(100%)" }}>Return home</span>
                  </div>
                </button>
              </div>
            </div>
          </div>
          <div className="hero_utility-page_cover">
            <img src="https://cdn.prod.website-files.com/680244911c3d7d28354cb55b/682402da44729946dbe193c6_404.avif" loading="lazy" sizes="100vw" srcSet="https://cdn.prod.website-files.com/680244911c3d7d28354cb55b/682402da44729946dbe193c6_404-p-500.png 500w, https://cdn.prod.website-files.com/680244911c3d7d28354cb55b/682402da44729946dbe193c6_404-p-800.png 800w, https://cdn.prod.website-files.com/680244911c3d7d28354cb55b/682402da44729946dbe193c6_404-p-1080.png 1080w, https://cdn.prod.website-files.com/680244911c3d7d28354cb55b/682402da44729946dbe193c6_404.avif 2880w" alt="" className="hero_utility-page_image" />
          </div>
        </section>
      </main>
    </div>
  );
};

export default NotFound;
