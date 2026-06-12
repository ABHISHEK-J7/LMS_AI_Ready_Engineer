/**
 * Shared schema options so every model serializes consistently:
 *  - `_id` is exposed as `id`
 *  - internal fields (`__v`, `passwordHash`) are stripped from JSON
 *  - timestamps are always on
 *
 * Intentionally left as an inferred literal (not annotated `SchemaOptions`) so
 * it stays structurally compatible with every model's specific document type.
 */
export const baseSchemaOptions = {
  timestamps: true,
  toJSON: {
    virtuals: true,
    versionKey: false,
    transform(_doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.passwordHash;
      return ret;
    },
  },
  toObject: { virtuals: true },
};

/**
 * Options for embedded subdocuments (e.g. module topics, assessment questions).
 * Parent `toJSON` settings do NOT cascade to subschemas in Mongoose, so each
 * subschema must opt in to the same `_id` → `id` serialization.
 */
export const subSchemaOptions = {
  _id: true,
  toJSON: {
    virtuals: true,
    versionKey: false,
    transform(_doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      return ret;
    },
  },
  toObject: { virtuals: true },
};
