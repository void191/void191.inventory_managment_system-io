const paths = {
  dashboard: (
    <>
      <rect className="module-icon__pulse module-icon__pulse--one" x="4" y="4" width="6" height="6" rx="1.5" />
      <rect className="module-icon__pulse module-icon__pulse--two" x="14" y="4" width="6" height="6" rx="1.5" />
      <rect className="module-icon__pulse module-icon__pulse--three" x="4" y="14" width="6" height="6" rx="1.5" />
      <rect className="module-icon__pulse module-icon__pulse--four" x="14" y="14" width="6" height="6" rx="1.5" />
    </>
  ),
  products: (
    <>
      <path className="module-icon__box-lid" d="M5 8.5 L12 4 L19 8.5 L12 13 Z" />
      <path d="M5 8.5 V16 L12 20 L19 16 V8.5" />
      <path d="M12 13 V20" />
    </>
  ),
  stock: (
    <>
      <path className="module-icon__layer module-icon__layer--one" d="M4 7.5 L12 3 L20 7.5 L12 12 Z" />
      <path className="module-icon__layer module-icon__layer--two" d="M4 12 L12 16.5 L20 12" />
      <path className="module-icon__layer module-icon__layer--three" d="M4 16.5 L12 21 L20 16.5" />
    </>
  ),
  purchase: (
    <>
      <path d="M8 5 H6.5 A2.5 2.5 0 0 0 4 7.5 V18.5 A2.5 2.5 0 0 0 6.5 21 H17.5 A2.5 2.5 0 0 0 20 18.5 V7.5 A2.5 2.5 0 0 0 17.5 5 H16" />
      <path d="M8 5.5 A2.5 2.5 0 0 1 10.5 3 H13.5 A2.5 2.5 0 0 1 16 5.5 V7 H8 Z" />
      <path className="module-icon__page" d="M8 11 H16 M8 15 H14" />
    </>
  ),
  sales: (
    <>
      <path className="module-icon__cart" d="M4 5 H6 L8 15 H17 L19 8 H7" />
      <circle className="module-icon__wheel module-icon__wheel--one" cx="10" cy="20" r="1.5" />
      <circle className="module-icon__wheel module-icon__wheel--two" cx="17" cy="20" r="1.5" />
    </>
  ),
  warehouses: (
    <>
      <path d="M4 20 V9 L12 4 L20 9 V20" />
      <path d="M7 20 H17" />
      <path className="module-icon__door" d="M10 20 V13 H14 V20" />
    </>
  ),
  suppliers: (
    <>
      <g className="module-icon__hand module-icon__hand--left">
        <path d="M14 14 L16.5 16.5 A1 1 0 1 0 19.5 13.5 L15.67 9.67 A3 3 0 0 0 11.43 9.67 L10.6 10.5 A1 1 0 0 1 9.18 10.5 L8.35 9.67 A3 3 0 0 0 4.11 9.67 L2 11.5" />
        <path d="M9 11 L11 9" />
        <path d="M6 14 L8 12" />
      </g>
      <g className="module-icon__hand module-icon__hand--right">
        <path d="M11 17 L13 19 A1 1 0 1 0 16 16" />
        <path d="M11 17 L13 19" />
      </g>
    </>
  ),
  movements: (
    <>
      <path className="module-icon__arrow module-icon__arrow--one" d="M5 8 H17 L14 5" />
      <path className="module-icon__arrow module-icon__arrow--two" d="M19 16 H7 L10 19" />
    </>
  ),
  reports: (
    <>
      <path d="M4 20 H20" />
      <path className="module-icon__bar module-icon__bar--one" d="M7 20 V14" />
      <path className="module-icon__bar module-icon__bar--two" d="M12 20 V9" />
      <path className="module-icon__bar module-icon__bar--three" d="M17 20 V12" />
    </>
  ),
};

function ModuleIcon({ iconKey, animate = false, className = '' }) {
  return (
    <svg
      className={`module-icon ${animate ? 'is-animating' : ''} ${className}`}
      viewBox="0 0 24 24"
      width="24"
      height="24"
      aria-hidden="true"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g>{paths[iconKey] ?? paths.dashboard}</g>
    </svg>
  );
}

export default ModuleIcon;
