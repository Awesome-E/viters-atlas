import type { ParentProps } from "solid-js";
import "./SlantWrapper.scss";

interface SlantWrapperProps extends ParentProps {
  class?: string;
  highContrast?: boolean;
}

export default function SlantWrapper({
  children,
  class: className = "",
  highContrast: lowContrast,
}: SlantWrapperProps) {
  if (lowContrast) className = "invert " + className;
  className = `slant-wrapper ${className}`.trim();
  return <div class={className}>{children}</div>;
}
