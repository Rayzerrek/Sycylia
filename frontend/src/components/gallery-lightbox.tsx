"use client";

import { DownloadSimpleIcon } from "@phosphor-icons/react";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import Video from "yet-another-react-lightbox/plugins/video";

import { downloadFile } from "@/lib/files";

import type { FileEntry } from "@/lib/files";
import type { Slide } from "yet-another-react-lightbox";

export interface GalleryLightboxProps {
  readonly open: boolean;
  readonly index: number;
  readonly slides: Slide[];
  readonly files: FileEntry[];
  readonly onClose: () => void;
  readonly onIndexChange: (index: number) => void;
}

export default function GalleryLightbox({
  open,
  index,
  slides,
  files,
  onClose,
  onIndexChange,
}: GalleryLightboxProps) {
  const currentFile = index >= 0 ? files[index] : undefined;

  return (
    <Lightbox
      open={open}
      index={index}
      slides={slides}
      close={onClose}
      plugins={[Video]}
      carousel={{ preload: 1 }}
      on={{
        view: ({ index: currentIndex }) => onIndexChange(currentIndex),
      }}
      toolbar={{
        buttons: [
          <button
            key="download"
            type="button"
            className="yarl__button"
            title="Pobierz"
            disabled={!currentFile}
            onClick={() => {
              if (currentFile) {
                void downloadFile(currentFile.name);
              }
            }}
          >
            <DownloadSimpleIcon size={20} weight="regular" />
          </button>,
          "close",
        ],
      }}
    />
  );
}
