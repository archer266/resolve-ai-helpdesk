import { useEffect, useRef } from "react";

export default function Modal({ titleId, onClose, busy, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current.querySelector("input, textarea, select, button")?.focus();
    return () => { document.body.style.overflow = before; previous?.focus(); };
  }, []);
  function keyDown(event) {
    if (event.key === "Escape" && !busy) onClose();
    if (event.key !== "Tab") return;
    const controls = [...ref.current.querySelectorAll("button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)")];
    const first = controls[0]; const last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
  return <div className="modal-backdrop" onMouseDown={() => !busy && onClose()}>
    <div ref={ref} className="modal" role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={keyDown} onMouseDown={(event) => event.stopPropagation()}>{children}</div>
  </div>;
}
