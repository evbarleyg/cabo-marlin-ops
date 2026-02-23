import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEFAULT_COORDINATES } from "@/lib/constants";
import { useOpsSettings } from "@/lib/app-context";

export function SettingsRoute() {
  const { settings, updateSettings, resetSettings } = useOpsSettings();
  const [latitude, setLatitude] = useState(settings.latitude.toString());
  const [longitude, setLongitude] = useState(settings.longitude.toString());

  const coordError = useMemo(() => {
    const lat = Number(latitude);
    const lon = Number(longitude);
    if (Number.isNaN(lat) || Number.isNaN(lon)) return "Coordinates must be numeric.";
    if (lat < -90 || lat > 90) return "Latitude must be between -90 and 90.";
    if (lon < -180 || lon > 180) return "Longitude must be between -180 and 180.";
    return null;
  }, [latitude, longitude]);

  function saveCoordinates() {
    if (coordError) return;
    updateSettings({ latitude: Number(latitude), longitude: Number(longitude) });
  }

  return (
    <div className="space-y-4 pb-20 md:pb-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">Customize base coordinates, units, and theme preferences saved in your browser.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Base Coordinates</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="latitude">Latitude</Label>
            <Input id="latitude" value={latitude} onChange={(event) => setLatitude(event.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="longitude">Longitude</Label>
            <Input id="longitude" value={longitude} onChange={(event) => setLongitude(event.target.value)} />
          </div>
          <div className="md:col-span-2 flex flex-wrap items-center gap-2">
            <Button onClick={saveCoordinates} disabled={Boolean(coordError)}>
              Save Coordinates
            </Button>
            <Badge variant="outline">
              Default: {DEFAULT_COORDINATES.latitude}, {DEFAULT_COORDINATES.longitude}
            </Badge>
          </div>
          {coordError ? <p className="md:col-span-2 text-sm text-destructive">{coordError}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Units</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <p className="text-sm font-medium">Temperature</p>
            <div className="flex gap-2">
              <Button variant={settings.temperatureUnit === "f" ? "default" : "outline"} size="sm" onClick={() => updateSettings({ temperatureUnit: "f" })}>
                Fahrenheit
              </Button>
              <Button variant={settings.temperatureUnit === "c" ? "default" : "outline"} size="sm" onClick={() => updateSettings({ temperatureUnit: "c" })}>
                Celsius
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Wave height</p>
            <div className="flex gap-2">
              <Button variant={settings.waveUnit === "m" ? "default" : "outline"} size="sm" onClick={() => updateSettings({ waveUnit: "m" })}>
                Meters
              </Button>
              <Button variant={settings.waveUnit === "ft" ? "default" : "outline"} size="sm" onClick={() => updateSettings({ waveUnit: "ft" })}>
                Feet
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Current speed</p>
            <div className="flex gap-2">
              <Button variant={settings.speedUnit === "mps" ? "default" : "outline"} size="sm" onClick={() => updateSettings({ speedUnit: "mps" })}>
                m/s
              </Button>
              <Button variant={settings.speedUnit === "knots" ? "default" : "outline"} size="sm" onClick={() => updateSettings({ speedUnit: "knots" })}>
                knots
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Theme + Reset</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          <Button variant={settings.theme === "dark" ? "default" : "outline"} onClick={() => updateSettings({ theme: "dark" })}>
            Dark
          </Button>
          <Button variant={settings.theme === "light" ? "default" : "outline"} onClick={() => updateSettings({ theme: "light" })}>
            Light
          </Button>
          <Button variant="ghost" onClick={resetSettings}>
            Reset all defaults
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
