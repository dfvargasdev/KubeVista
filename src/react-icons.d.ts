import { FC, SVGAttributes } from "react";

interface IconBaseProps extends SVGAttributes<SVGElement> {
  size?: string | number;
  color?: string;
  title?: string;
}

declare module "react-icons/fi" {
  export type IconType = FC<IconBaseProps>;

  export const FiServer: IconType;
  export const FiChevronDown: IconType;
  export const FiRefreshCw: IconType;
  export const FiAlertCircle: IconType;
  export const FiFileText: IconType;
  export const FiTrash2: IconType;
}
