import { z } from "zod";

const identityRegex = /^\d{4}-?\d{4}-?\d{5}$/;
const uuidSchema = z.uuid("Identificador invalido.");

export const identitySchema = z
  .string()
  .trim()
  .regex(identityRegex, "Use un formato valido de identidad: 0000-0000-00000.");

export const statusSchema = z.enum(["activo", "inactivo"]);
export const electionStatusSchema = z.enum(["pendiente", "activa", "finalizada"]);

export const cargoSchema = z.object({
  nombre: z.string().trim().min(3, "Ingrese al menos 3 caracteres.").max(80),
  descripcion: z.string().trim().max(240).optional().nullable(),
  max_candidatos: z.number().int().min(1).max(50),
  estado: statusSchema,
  orden: z.number().int().min(0).max(999),
});

const electionBaseSchema = z.object({
  nombre: z.string().trim().min(4, "Ingrese un nombre de eleccion.").max(120),
  descripcion: z.string().trim().max(320).optional().nullable(),
  fecha_inicio: z.string().min(1, "Seleccione la fecha de inicio."),
  fecha_cierre: z.string().min(1, "Seleccione la fecha de cierre."),
  estado: electionStatusSchema,
});

// Schema for creating an election (requires date validation)
export const electionSchema = electionBaseSchema.refine(
  (value) => new Date(value.fecha_cierre) > new Date(value.fecha_inicio),
  {
    message: "La fecha de cierre debe ser posterior a la fecha de inicio.",
    path: ["fecha_cierre"],
  },
);

// Schema for updating an election (partial, no cross-field refinement)
export const electionUpdateSchema = electionBaseSchema.partial();

export const candidateSchema = z.object({
  eleccion_id: uuidSchema,
  nombre_completo: z.string().trim().min(5, "Ingrese el nombre completo.").max(140),
  identidad: identitySchema,
  biografia: z.string().trim().max(900).optional().nullable(),
  foto_url: z
    .string()
    .trim()
    .refine((value) => value === "" || URL.canParse(value), {
      message: "La fotografia debe ser una URL valida.",
    })
    .optional()
    .nullable(),
  estado: statusSchema,
});

export const voterSchema = z.object({
  nombre_completo: z.string().trim().min(5, "Ingrese su nombre completo.").max(140),
  identidad: identitySchema,
});

export const voteSelectionSchema = z.object({
  cargo_id: uuidSchema,
  candidato_id: uuidSchema,
});

export const castVoteSchema = z.object({
  eleccion_id: uuidSchema,
  votante: voterSchema,
  selections: z.array(voteSelectionSchema).min(1, "Seleccione al menos un candidato."),
});

export type CargoFormValues = z.infer<typeof cargoSchema>;
export type ElectionFormValues = z.infer<typeof electionSchema>;
export type CandidateFormValues = z.infer<typeof candidateSchema>;
export type VoterFormValues = z.infer<typeof voterSchema>;
export type CastVoteValues = z.infer<typeof castVoteSchema>;
