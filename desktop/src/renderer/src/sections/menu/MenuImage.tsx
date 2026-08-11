import { useState } from "react";
import { UtensilsCrossed } from "lucide-react";

export function MenuImage({
  url,
  alt,
  className = "",
  iconClassName = "",
}: {
  url: string;
  alt: string;
  className?: string;
  iconClassName?: string;
}) {
  const [failed, setFailed] = useState(false);
  const show = url !== "" && /^https:\/\//i.test(url) && !failed;
  if (!show) {
    return (
      <div className={`flex shrink-0 items-center justify-center bg-card-2 text-muted ${className || "size-12 rounded-xl"}`}>
        <UtensilsCrossed className={`${iconClassName || "size-5"}`} />
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`shrink-0 object-cover ${className || "size-12 rounded-xl"}`}
    />
  );
}
