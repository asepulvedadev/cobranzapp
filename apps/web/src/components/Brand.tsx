import Image from "next/image";
import Link from "next/link";

type BrandProps = {
  href?: string;
  light?: boolean;
};

export function Brand({ href = "/", light = false }: BrandProps) {
  return (
    <Link className="brand" href={href} aria-label="cobranzapp, ir al inicio">
      <Image
        src={light ? "/brand-isotype-reversed.svg" : "/brand.svg"}
        alt=""
        width={38}
        height={38}
        priority
      />
      <span>cobranzapp</span>
    </Link>
  );
}
