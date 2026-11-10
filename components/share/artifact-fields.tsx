"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ARTIFACT_TYPE_LABELS,
  ARTIFACT_TYPES,
  detectArtifactType,
  type ArtifactType,
} from "@/lib/artifact";

const PUBLISH_ARTIFACT_TYPES = ARTIFACT_TYPES.filter(
  (type) => type !== "link"
) as Exclude<ArtifactType, "link">[];

type ArtifactFieldsProps = {
  idPrefix: string;
  artifactUrl: string;
  artifactType: ArtifactType | "";
  onArtifactUrlChange: (url: string) => void;
  onArtifactTypeChange: (type: ArtifactType | "") => void;
  disabled?: boolean;
};

/**
 * Optional Artifact URL + type controls for the Share / import forms.
 */
export function ArtifactFields({
  idPrefix,
  artifactUrl,
  artifactType,
  onArtifactUrlChange,
  onArtifactTypeChange,
  disabled,
}: ArtifactFieldsProps) {
  function handleUrlChange(next: string) {
    onArtifactUrlChange(next);
    if (!next.trim()) {
      onArtifactTypeChange("");
      return;
    }
    // Auto-detect when empty or still matching prior auto suggestion.
    if (!artifactType || artifactType === detectArtifactType(artifactUrl)) {
      onArtifactTypeChange(detectArtifactType(next));
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-dashed border-amber-300/50 bg-amber-50/40 p-3">
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-artifact-url`}>
          Artifact URL (Optional)
        </Label>
        <Input
          id={`${idPrefix}-artifact-url`}
          type="url"
          inputMode="url"
          value={artifactUrl}
          onChange={(event) => handleUrlChange(event.target.value)}
          placeholder="https://… (image, video, audio, or interactive app)"
          disabled={disabled}
          aria-describedby={`${idPrefix}-artifact-hint`}
        />
        <p
          id={`${idPrefix}-artifact-hint`}
          className="text-xs text-muted-foreground"
        >
          Link an external AI-generated artifact instead of uploading the file.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-artifact-type`}>Artifact Type</Label>
        <Select
          value={artifactType || undefined}
          onValueChange={(value) =>
            onArtifactTypeChange(value as ArtifactType)
          }
          disabled={disabled || !artifactUrl.trim()}
        >
          <SelectTrigger id={`${idPrefix}-artifact-type`}>
            <SelectValue placeholder="Auto-detect from URL" />
          </SelectTrigger>
          <SelectContent>
            {PUBLISH_ARTIFACT_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {ARTIFACT_TYPE_LABELS[type]}
              </SelectItem>
            ))}
            <SelectItem value="link">Link</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
