import { useEffect, useState } from "react";
import FingerprintJS from "@fingerprintjs/fingerprintjs";

let fpPromise: ReturnType<typeof FingerprintJS.load> | null = null;

function getFP() {
  if (!fpPromise) {
    fpPromise = FingerprintJS.load();
  }
  return fpPromise;
}

export function useDeviceFingerprint() {
  const [fingerprint, setFingerprint] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getFP()
      .then((fp) => fp.get())
      .then((result) => {
        setFingerprint(result.visitorId);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return { fingerprint, loading };
}
