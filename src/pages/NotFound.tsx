import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { handle404 } from "@/api/404-message";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [contextualMessage, setContextualMessage] = useState({ message: "Page not found", suggestion: null as any });
  const [isVisible, setIsVisible] = useState(false);

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

    // Trigger entrance animation
    const timer = setTimeout(() => setIsVisible(true), 50);

    // Cleanup function to remove Webflow CSS leakage when moving to other pages
    return () => {
      clearTimeout(timer);
      const links = document.querySelectorAll('link[href*="webflow.shared"]');
      links.forEach(link => link.remove());
    };
  }, [location.pathname]);

  return (
    <div className="not-found-wrapper">
      <Helmet>
        <title>Page Not Found — Nasaka IEBC</title>
        <link href="https://fonts.googleapis.com" rel="preconnect" />
        <link href="https://fonts.gstatic.com" rel="preconnect" crossOrigin="anonymous" />
        <style>{`
          .not-found-wrapper {
            min-height: 100vh;
            width: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            overflow: hidden;
            background: linear-gradient(135deg, #0a0a0a 0%, #111827 50%, #0f172a 100%);
            font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          }

          /* Animated gradient orbs */
          .not-found-wrapper::before,
          .not-found-wrapper::after {
            content: '';
            position: absolute;
            border-radius: 50%;
            filter: blur(120px);
            opacity: 0.15;
            animation: orbFloat 12s ease-in-out infinite;
          }
          .not-found-wrapper::before {
            width: 600px;
            height: 600px;
            background: radial-gradient(circle, #007AFF, transparent 70%);
            top: -200px;
            right: -100px;
            animation-delay: 0s;
          }
          .not-found-wrapper::after {
            width: 500px;
            height: 500px;
            background: radial-gradient(circle, #22c55e, transparent 70%);
            bottom: -150px;
            left: -100px;
            animation-delay: -6s;
          }

          @keyframes orbFloat {
            0%, 100% { transform: translate(0, 0) scale(1); }
            33% { transform: translate(30px, -20px) scale(1.05); }
            66% { transform: translate(-20px, 15px) scale(0.95); }
          }

          /* Grain overlay */
          .nf-grain {
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            z-index: 1;
            pointer-events: none;
            background-image: url('https://cdn.prod.website-files.com/680244911c3d7d28354cb55b/6839aa669993efdfdc9e89d1_Noise.webp');
            background-size: 200px;
            opacity: 0.03;
            animation: nfGrain 0.5s steps(6) infinite;
          }
          @keyframes nfGrain {
            0%, 100% { transform: translate(0, 0); }
            17% { transform: translate(-5%, -10%); }
            50% { transform: translate(12%, 9%); }
            83% { transform: translate(-1%, 7%); }
          }

          /* Main card */
          .nf-card {
            position: relative;
            z-index: 10;
            max-width: 480px;
            width: calc(100% - 48px);
            padding: 48px 40px;
            border-radius: 28px;
            background: rgba(255, 255, 255, 0.04);
            backdrop-filter: blur(40px) saturate(1.2);
            -webkit-backdrop-filter: blur(40px) saturate(1.2);
            border: 1px solid rgba(255, 255, 255, 0.08);
            box-shadow:
              0 0 0 1px rgba(255, 255, 255, 0.03),
              0 8px 40px rgba(0, 0, 0, 0.4),
              0 2px 12px rgba(0, 0, 0, 0.2),
              inset 0 1px 0 rgba(255, 255, 255, 0.06);
            text-align: center;
            opacity: 0;
            transform: translateY(24px) scale(0.97);
            transition: opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1),
                        transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
          }
          .nf-card.is-visible {
            opacity: 1;
            transform: translateY(0) scale(1);
          }

          /* Error code */
          .nf-code {
            font-size: 96px;
            font-weight: 800;
            letter-spacing: -4px;
            line-height: 1;
            background: linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.3) 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            margin-bottom: 8px;
            font-family: 'DM Sans', -apple-system, sans-serif;
          }

          /* Status label */
          .nf-status {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 6px 14px;
            border-radius: 100px;
            background: rgba(239, 68, 68, 0.12);
            border: 1px solid rgba(239, 68, 68, 0.2);
            color: #fca5a5;
            font-size: 12px;
            font-weight: 600;
            letter-spacing: 0.5px;
            text-transform: uppercase;
            margin-bottom: 24px;
          }
          .nf-status-dot {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: #ef4444;
            animation: nfPulse 2s ease-in-out infinite;
          }
          @keyframes nfPulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
          }

          /* Message */
          .nf-message {
            color: rgba(255, 255, 255, 0.6);
            font-size: 15px;
            line-height: 1.6;
            margin-bottom: 8px;
            font-weight: 400;
          }

          /* Path display */
          .nf-path {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 8px;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.08);
            color: rgba(255, 255, 255, 0.4);
            font-size: 12px;
            font-family: 'JetBrains Mono', 'SF Mono', monospace;
            margin-bottom: 32px;
            word-break: break-all;
          }

          /* Divider */
          .nf-divider {
            width: 48px;
            height: 1px;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent);
            margin: 0 auto 28px;
          }

          /* Buttons container */
          .nf-actions {
            display: flex;
            flex-direction: column;
            gap: 10px;
            align-items: center;
          }

          /* Primary button */
          .nf-btn-primary {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            width: 100%;
            padding: 14px 28px;
            border-radius: 14px;
            background: linear-gradient(135deg, #007AFF 0%, #0055CC 100%);
            color: #fff;
            font-size: 15px;
            font-weight: 600;
            font-family: inherit;
            border: none;
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            box-shadow:
              0 2px 12px rgba(0, 122, 255, 0.25),
              inset 0 1px 0 rgba(255, 255, 255, 0.15);
            letter-spacing: 0.2px;
          }
          .nf-btn-primary:hover {
            transform: translateY(-1px);
            box-shadow:
              0 4px 20px rgba(0, 122, 255, 0.35),
              inset 0 1px 0 rgba(255, 255, 255, 0.2);
          }
          .nf-btn-primary:active {
            transform: translateY(0);
            box-shadow:
              0 1px 6px rgba(0, 122, 255, 0.2),
              inset 0 1px 0 rgba(255, 255, 255, 0.1);
          }

          /* Secondary button */
          .nf-btn-secondary {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            width: 100%;
            padding: 14px 28px;
            border-radius: 14px;
            background: rgba(255, 255, 255, 0.06);
            color: rgba(255, 255, 255, 0.8);
            font-size: 15px;
            font-weight: 500;
            font-family: inherit;
            border: 1px solid rgba(255, 255, 255, 0.1);
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            letter-spacing: 0.2px;
          }
          .nf-btn-secondary:hover {
            background: rgba(255, 255, 255, 0.1);
            border-color: rgba(255, 255, 255, 0.15);
            transform: translateY(-1px);
          }
          .nf-btn-secondary:active {
            transform: translateY(0);
            background: rgba(255, 255, 255, 0.08);
          }

          /* Suggestion section */
          .nf-suggestion-label {
            color: rgba(255, 255, 255, 0.35);
            font-size: 11px;
            font-weight: 600;
            letter-spacing: 1.2px;
            text-transform: uppercase;
            margin-bottom: 8px;
          }

          /* Button icon */
          .nf-btn-icon {
            width: 16px;
            height: 16px;
            flex-shrink: 0;
          }

          /* Responsive */
          @media (max-width: 480px) {
            .nf-card {
              padding: 36px 28px;
              border-radius: 22px;
            }
            .nf-code {
              font-size: 72px;
              letter-spacing: -3px;
            }
          }
        `}</style>
      </Helmet>

      <div className="nf-grain"></div>

      <div className={`nf-card ${isVisible ? 'is-visible' : ''}`}>
        {/* Error Code — Prominent */}
        <div className="nf-code">404</div>

        {/* Status Badge */}
        <div className="nf-status">
          <div className="nf-status-dot"></div>
          {contextualMessage.message}
        </div>

        {/* Explanatory Message */}
        <p className="nf-message">
          The page you're looking for doesn't exist or has been moved to a new location.
        </p>

        {/* Path Display */}
        <div className="nf-path">{location.pathname}</div>

        {/* Divider */}
        <div className="nf-divider"></div>

        {/* Actions */}
        <div className="nf-actions">
          {/* Suggestion Button (if available) */}
          {contextualMessage.suggestion && (
            <>
              <div className="nf-suggestion-label">Did you mean?</div>
              <button
                className="nf-btn-primary"
                onClick={() => navigate(contextualMessage.suggestion?.path || "/")}
              >
                <svg className="nf-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
                {contextualMessage.suggestion.label}
              </button>
            </>
          )}

          {/* Return to Map */}
          <button
            className={contextualMessage.suggestion ? "nf-btn-secondary" : "nf-btn-primary"}
            onClick={() => navigate('/map')}
          >
            <svg className="nf-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
              <line x1="8" y1="2" x2="8" y2="18" />
              <line x1="16" y1="6" x2="16" y2="22" />
            </svg>
            Return to Map
          </button>

          {/* Return Home */}
          <button
            className="nf-btn-secondary"
            onClick={() => navigate('/')}
          >
            <svg className="nf-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            Return Home
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
