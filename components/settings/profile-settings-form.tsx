"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface ProfileSettingsFormProps {
  username: string;
}

export function ProfileSettingsForm({ username }: ProfileSettingsFormProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Account</CardTitle>
        <CardDescription>
          Your permanent ChatShare identifier.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <Label htmlFor="settings-username">Username</Label>
          <Input
            id="settings-username"
            name="username"
            value={username}
            readOnly
            disabled
            aria-describedby="settings-username-hint"
          />
          <p
            id="settings-username-hint"
            className="text-xs text-muted-foreground"
          >
            Your unique identifier. This cannot be changed.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
