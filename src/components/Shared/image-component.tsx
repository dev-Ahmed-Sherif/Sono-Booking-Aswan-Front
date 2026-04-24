"use client";

import Image, { ImageProps as NextImageProps } from "next/image";
import { useState } from "react";

type ImageComponentProps = Omit<NextImageProps, "onError"> & {
  fallbackSrc?: string;
  loading?: "lazy" | "eager";
  priority?: boolean;
};

const ImageComponent: React.FC<ImageComponentProps> = ({
  className,
  src,
  width,
  height,
  alt,
  fallbackSrc = "/placeholder.png",
  loading = "lazy",
  priority = false,
  ...rest
}) => {
  const [imgSrc, setImgSrc] = useState(src);

  const handleError = () => {
    setImgSrc(fallbackSrc);
  };

  return (
    <Image
      className={className}
      src={imgSrc}
      width={width}
      height={height}
      alt={alt}
      {...(priority ? {} : { loading })}
      priority={priority}
      onError={handleError}
      {...rest}
      sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
    />
  );
};

export default ImageComponent;
