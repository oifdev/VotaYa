export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type ElectionStatus = "pendiente" | "activa" | "finalizada";
export type RecordStatus = "activo" | "inactivo";
export type UserRole = "admin" | "auditor";

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          role: UserRole;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          role?: UserRole;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          email?: string;
          full_name?: string | null;
          role?: UserRole;
          updated_at?: string;
        };
        Relationships: [];
      };
      elecciones: {
        Row: {
          id: string;
          organizer_id: string;
          nombre: string;
          descripcion: string | null;
          fecha_inicio: string;
          fecha_cierre: string;
          estado: ElectionStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organizer_id?: string;
          nombre: string;
          descripcion?: string | null;
          fecha_inicio: string;
          fecha_cierre: string;
          estado?: ElectionStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          organizer_id?: string;
          nombre?: string;
          descripcion?: string | null;
          fecha_inicio?: string;
          fecha_cierre?: string;
          estado?: ElectionStatus;
          updated_at?: string;
        };
        Relationships: [];
      };
      cargos: {
        Row: {
          id: string;
          eleccion_id: string;
          nombre: string;
          descripcion: string | null;
          max_candidatos: number;
          estado: RecordStatus;
          orden: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          eleccion_id: string;
          nombre: string;
          descripcion?: string | null;
          max_candidatos?: number;
          estado?: RecordStatus;
          orden?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          eleccion_id?: string;
          nombre?: string;
          descripcion?: string | null;
          max_candidatos?: number;
          estado?: RecordStatus;
          orden?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      candidatos: {
        Row: {
          id: string;
          eleccion_id: string;
          nombre_completo: string;
          identidad: string;
          biografia: string | null;
          foto_url: string | null;
          estado: RecordStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          eleccion_id: string;
          nombre_completo: string;
          identidad: string;
          biografia?: string | null;
          foto_url?: string | null;
          estado?: RecordStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          eleccion_id?: string;
          nombre_completo?: string;
          identidad?: string;
          biografia?: string | null;
          foto_url?: string | null;
          estado?: RecordStatus;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "candidatos_eleccion_id_fkey";
            columns: ["eleccion_id"];
            isOneToOne: false;
            referencedRelation: "elecciones";
            referencedColumns: ["id"];
          },
        ];
      };
      votantes: {
        Row: {
          id: string;
          eleccion_id: string;
          nombre_completo: string;
          identidad_hash: string;
          identidad_masked: string;
          ip_address: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          eleccion_id: string;
          nombre_completo: string;
          identidad_hash: string;
          identidad_masked: string;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: Record<string, never>;
        Relationships: [
          {
            foreignKeyName: "votantes_eleccion_id_fkey";
            columns: ["eleccion_id"];
            isOneToOne: false;
            referencedRelation: "elecciones";
            referencedColumns: ["id"];
          },
        ];
      };
      votos: {
        Row: {
          id: string;
          eleccion_id: string;
          votante_id: string;
          cargo_id: string;
          candidato_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          eleccion_id: string;
          votante_id: string;
          cargo_id: string;
          candidato_id: string;
          created_at?: string;
        };
        Update: Record<string, never>;
        Relationships: [
          {
            foreignKeyName: "votos_candidato_id_fkey";
            columns: ["candidato_id"];
            isOneToOne: false;
            referencedRelation: "candidatos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "votos_cargo_id_fkey";
            columns: ["cargo_id"];
            isOneToOne: false;
            referencedRelation: "cargos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "votos_eleccion_id_fkey";
            columns: ["eleccion_id"];
            isOneToOne: false;
            referencedRelation: "elecciones";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "votos_votante_id_fkey";
            columns: ["votante_id"];
            isOneToOne: false;
            referencedRelation: "votantes";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_logs: {
        Row: {
          id: string;
          actor_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          metadata: Json | null;
          ip_address: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_id?: string | null;
          action: string;
          entity_type: string;
          entity_id?: string | null;
          metadata?: Json | null;
          ip_address?: string | null;
          created_at?: string;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      cast_vote: {
        Args: {
          p_eleccion_id: string;
          p_nombre_completo: string;
          p_identidad: string;
          p_votes: Json;
          p_ip_address?: string | null;
          p_user_agent?: string | null;
        };
        Returns: string;
      };
      has_voted: {
        Args: {
          p_eleccion_id: string;
          p_identidad: string;
        };
        Returns: boolean;
      };
    };
    Enums: {
      election_status: ElectionStatus;
      record_status: RecordStatus;
      user_role: UserRole;
    };
    CompositeTypes: Record<string, never>;
  };
}

export type Cargo = Database["public"]["Tables"]["cargos"]["Row"];
export type Candidato = Database["public"]["Tables"]["candidatos"]["Row"];
export type Eleccion = Database["public"]["Tables"]["elecciones"]["Row"];
export type Votante = Database["public"]["Tables"]["votantes"]["Row"];
export type Voto = Database["public"]["Tables"]["votos"]["Row"];
export type AdminUser = Database["public"]["Tables"]["users"]["Row"];
export type AuditLog = Database["public"]["Tables"]["audit_logs"]["Row"];
