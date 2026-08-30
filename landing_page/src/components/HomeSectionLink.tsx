"use client";

import type { ReactNode } from "react";
import { Link, usePathname } from "@/i18n/navigation";

type HomeSectionLinkProps = {
  href: string;
  className?: string;
  children: ReactNode;
  onClick?: () => void;
};

function toHash(href: string) {
  if (href.startsWith("/#")) return href.slice(1);
  if (href.startsWith("#")) return href;
  return `#${href}`;
}

export function HomeSectionLink({ href, className, children, onClick }: HomeSectionLinkProps) {
  const pathname = usePathname();
  const hash = toHash(href);
  const onHome = pathname === "/";

  if (onHome) {
    return (
      <a href={hash} className={className} onClick={onClick}>
        {children}
      </a>
    );
  }

  return (
    <Link href={`/${hash}`} className={className} onClick={onClick}>
      {children}
    </Link>
  );
}
