import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useEpisodeStore } from "../stores/episodeStore";
import { cancelProcessing, cleanvoiceCancel } from "../lib/tauri";

/**
 * Returns a callback that cancels any active processing jobs,
 * resets wizard state, and navigates to the new-episode page.
 */
export function useNewEpisode() {
  const navigate = useNavigate();
  const resetWizard = useEpisodeStore((s) => s.resetWizard);

  return useCallback(() => {
    // Fire-and-forget: stop backend work so it doesn't waste resources
    cancelProcessing().catch(() => {});
    cleanvoiceCancel().catch(() => {});

    // Reset bumps wizardSessionId, which invalidates any in-flight
    // async handlers that captured the previous session ID.
    resetWizard();
    navigate("/new-episode");
  }, [resetWizard, navigate]);
}
