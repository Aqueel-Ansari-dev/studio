import Image from "next/image";
import illustrations, { IllustrationKey } from "@/lib/illustrations";

interface IllustrationProps {
  name: IllustrationKey;
  className?: string;
  alt?: string;
}

export default function Illustration({ name, className, alt }: IllustrationProps) {
  const src = illustrations[name];
  if (!src) return null;
  return <Image src={src} alt={alt || name} width={300} height={200} className={className} />;
}
