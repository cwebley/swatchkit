# Migrating From v5 To v6

SwatchKit v6 is a breaking release for token output controls.

The main change: generated-output visibility moved out of `tokenDocs` and into the new `tokenBlocks` config API.

## What Changed

In v5, `tokenDocs` controlled both documentation presentation and documentation visibility:

```js
tokenDocs: {
  colors: {
    includeLabels: ["Brand Colors"],
    excludeLabels: ["Internal Colors"],
  },
  spacing: {
    enabled: false,
  },
}
```

In v6, `tokenDocs` is presentation-only. Use `tokenBlocks` to control whether docs or utilities are generated.

```js
tokenBlocks: {
  colors: {
    docs: {
      includeLabels: ["Brand Colors"],
      excludeLabels: ["Internal Colors"],
    },
  },
  spacing: {
    docs: {
      includeLabels: [],
    },
  },
},
tokenDocs: {
  showSource: false,
  colors: {
    columns: ["name", "value", "customProperty"],
  },
},
```

## Removed `tokenDocs` Options

These options are removed in v6:

```js
tokenDocs: {
  colors: {
    includeLabels: ["Brand Colors"],
    excludeLabels: ["Internal Colors"],
    enabled: false,
  },
}
```

If SwatchKit sees these options, the build fails with a migration error.

## Replacement: `tokenBlocks`

Use `tokenBlocks` for generated-output controls:

```js
tokenBlocks: {
  textSizes: {
    docs: {
      excludeLabels: ["Steps"],
    },
    utilities: {
      excludeLabels: ["Typography"],
    },
    labels: {
      Steps: { docs: false, utilities: true },
      Typography: { docs: true, utilities: false },
    },
  },
}
```

Defaults:

- `docs: true`
- `utilities: true` for token types that generate utilities
- `utilities: false` for `viewports`

Precedence:

```txt
library defaults < tokenBlocks[type].docs/utilities filters < tokenBlocks[type].labels[label]
```

## Common Migrations

### Hide Docs For A Label

v5:

```js
tokenDocs: {
  colors: {
    excludeLabels: ["Internal Colors"],
  },
}
```

v6:

```js
tokenBlocks: {
  colors: {
    docs: {
      excludeLabels: ["Internal Colors"],
    },
  },
}
```

### Include Docs For Only Certain Labels

v5:

```js
tokenDocs: {
  colors: {
    includeLabels: ["Brand Colors"],
  },
}
```

v6:

```js
tokenBlocks: {
  colors: {
    docs: {
      includeLabels: ["Brand Colors"],
    },
  },
}
```

### Disable Docs For A Token Type

v5:

```js
tokenDocs: {
  spacing: {
    enabled: false,
  },
}
```

v6:

```js
tokenBlocks: {
  spacing: {
    docs: {
      includeLabels: [],
    },
  },
}
```

### Keep Docs But Disable Utilities

This is new in v6:

```js
tokenBlocks: {
  textSizes: {
    labels: {
      Typography: {
        docs: true,
        utilities: false,
      },
    },
  },
}
```

When utilities are disabled for a docs page, SwatchKit omits utility class examples from that generated docs page.

## Supported Type Keys

`tokenBlocks` supports JavaScript-friendly aliases:

```js
colors
spacing
textSizes
textWeights
textLeading
fonts
viewports
```

Canonical CSS marker keys also work when quoted:

```js
"text-sizes"
"text-weights"
"text-leading"
```

Do not configure both an alias and its canonical key:

```js
tokenBlocks: {
  textSizes: {},
  "text-sizes": {},
}
```

This is an error in v6.

## Validation Is Stricter

v6 fails fast for invalid token output config, including:

- unknown `tokenBlocks` type keys
- alias collisions like `textSizes` and `"text-sizes"`
- unknown output names
- non-boolean `docs` or `utilities` label values
- invalid `includeLabels` or `excludeLabels` values
- explicit `utilities: true` for `viewports`
- removed `tokenDocs` visibility controls

## Utility De-Duping

Utility controls are block-level emission controls, not global token-name deny lists.

If one disabled block and one enabled block both contain `--step-0`, the `.font-size:step-0` rule still generates from the enabled block.

## `tokenDocs` After v6

Keep using `tokenDocs` for presentation options:

```js
tokenDocs: {
  showSource: true,
  colors: {
    columns: ["name", "value", "customProperty"],
    columnLabels: {
      customProperty: "CSS variable",
    },
  },
}
```

Use `tokenBlocks` for output visibility.
