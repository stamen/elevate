# elevate

Enrich GeoJSON features using the MapQuest Open Elevation API.

## Usage

To add height and distance as `Z` and `M` coordinates to your GeoJSON-formatted
data:

```bash
elevate data.json > enriched.json
```

## Environment Variables

* `MAPQUEST_API_KEY` - MapQuest API key. Required.
