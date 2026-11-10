import { BRAND } from "../brand";

export function Logo() {
  return (
    <a className="logo" href="#top" aria-label={`${BRAND.name} home`}>
      <img
        src="/logo.png"
        alt={BRAND.name}
        className="logo-img"
      />
    </a>
  );
}
