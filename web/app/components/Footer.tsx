"use client";

/**
 * Site-wide footer with the same nav targets as the top NavBeams.
 * Mounted on home/archives/gallery/about so visitors don't have to
 * scroll back to the top to keep browsing.
 */
export default function Footer() {
  return (
    <footer className="site-footer">
      <a href="/" className="footer-link">Home</a>
      <span className="footer-sep">·</span>
      <a href="/archives" className="footer-link">Archives</a>
      <span className="footer-sep">·</span>
      <a href="/gallery" className="footer-link">Gallery</a>
      <span className="footer-sep">·</span>
      <a href="/about" className="footer-link">About</a>
      <span className="footer-sep">·</span>
      <a
        href="https://github.com/philMarcus/autonomy"
        target="_blank"
        rel="noopener noreferrer"
        className="footer-link"
      >
        Source
      </a>
    </footer>
  );
}
