
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "appointment_history": {
                  Row: {
                    "action": Database["public"]['Enums']["history_action"],"actor_id": string | null,"appointment_id": string,"created_at": string,"id": string,"new_values": NonNullable<Json>,"owner_id": string,"previous_values": Json | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": Database["public"]['Enums']["history_action"],"actor_id"?: string | null,"appointment_id": string,"created_at"?: string,"id"?: string,"new_values": NonNullable<Json>,"owner_id": string,"previous_values"?: Json | null
                  }
                  Update: {
                    "action"?: Database["public"]['Enums']["history_action"],"actor_id"?: string | null,"appointment_id"?: string,"created_at"?: string,"id"?: string,"new_values"?: NonNullable<Json>,"owner_id"?: string,"previous_values"?: Json | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "appointment_history_appointment_id_fkey"
      columns: ["appointment_id"]
isOneToOne: false
      referencedRelation: "appointments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "appointment_history_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"appointment_reminders": {
                  Row: {
                    "appointment_id": string,"sent_at": string,"starts_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "appointment_id": string,"sent_at"?: string,"starts_at": string
                  }
                  Update: {
                    "appointment_id"?: string,"sent_at"?: string,"starts_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "appointment_reminders_appointment_id_fkey"
      columns: ["appointment_id"]
isOneToOne: false
      referencedRelation: "appointments"
      referencedColumns: ["id"]
    }
                  ]
                },"appointments": {
                  Row: {
                    "canceled_at": string | null,"cancellation_reason": string | null,"client_name": string,"client_phone": string | null,"created_at": string,"ends_at": string,"id": string,"notes": string | null,"owner_id": string,"reminder_anchor_at": string,"service_name": string,"starts_at": string,"status": Database["public"]['Enums']["appointment_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "canceled_at"?: string | null,"cancellation_reason"?: string | null,"client_name": string,"client_phone"?: string | null,"created_at"?: string,"ends_at": string,"id"?: string,"notes"?: string | null,"owner_id": string,"reminder_anchor_at"?: string,"service_name": string,"starts_at": string,"status"?: Database["public"]['Enums']["appointment_status"],"updated_at"?: string
                  }
                  Update: {
                    "canceled_at"?: string | null,"cancellation_reason"?: string | null,"client_name"?: string,"client_phone"?: string | null,"created_at"?: string,"ends_at"?: string,"id"?: string,"notes"?: string | null,"owner_id"?: string,"reminder_anchor_at"?: string,"service_name"?: string,"starts_at"?: string,"status"?: Database["public"]['Enums']["appointment_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "appointments_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"business_hours": {
                  Row: {
                    "end_time": string,"id": string,"owner_id": string,"start_time": string,"weekday": number
                  }
                  ComputedFields: never
                  Insert: {
                    "end_time": string,"id"?: string,"owner_id": string,"start_time": string,"weekday": number
                  }
                  Update: {
                    "end_time"?: string,"id"?: string,"owner_id"?: string,"start_time"?: string,"weekday"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "business_hours_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"favorite_services": {
                  Row: {
                    "color": string | null,"created_at": string,"duration_minutes": number,"id": string,"is_active": boolean,"name": string,"owner_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "color"?: string | null,"created_at"?: string,"duration_minutes": number,"id"?: string,"is_active"?: boolean,"name": string,"owner_id"?: string,"updated_at"?: string
                  }
                  Update: {
                    "color"?: string | null,"created_at"?: string,"duration_minutes"?: number,"id"?: string,"is_active"?: boolean,"name"?: string,"owner_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "favorite_services_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "business_name": string | null,"created_at": string,"default_duration_minutes": number,"default_view": string,"display_name": string,"hide_client_name_in_notifications": boolean,"id": string,"reminder_minutes": number | null,"slot_interval_minutes": number,"timezone": string,"updated_at": string,"week_starts_on": number
                  }
                  ComputedFields: never
                  Insert: {
                    "business_name"?: string | null,"created_at"?: string,"default_duration_minutes"?: number,"default_view"?: string,"display_name": string,"hide_client_name_in_notifications"?: boolean,"id": string,"reminder_minutes"?: number | null,"slot_interval_minutes"?: number,"timezone"?: string,"updated_at"?: string,"week_starts_on"?: number
                  }
                  Update: {
                    "business_name"?: string | null,"created_at"?: string,"default_duration_minutes"?: number,"default_view"?: string,"display_name"?: string,"hide_client_name_in_notifications"?: boolean,"id"?: string,"reminder_minutes"?: number | null,"slot_interval_minutes"?: number,"timezone"?: string,"updated_at"?: string,"week_starts_on"?: number
                  }
                  Relationships: [
                    
                  ]
                },"push_subscriptions": {
                  Row: {
                    "auth": string,"created_at": string,"device_label": string | null,"endpoint": string,"id": string,"last_used_at": string | null,"owner_id": string,"p256dh": string
                  }
                  ComputedFields: never
                  Insert: {
                    "auth": string,"created_at"?: string,"device_label"?: string | null,"endpoint": string,"id"?: string,"last_used_at"?: string | null,"owner_id"?: string,"p256dh": string
                  }
                  Update: {
                    "auth"?: string,"created_at"?: string,"device_label"?: string | null,"endpoint"?: string,"id"?: string,"last_used_at"?: string | null,"owner_id"?: string,"p256dh"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "push_subscriptions_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "cancel_appointment":
{ Args: { "p_id": string,"p_reason"?: string }; Returns: {
              "canceled_at": string | null,
"cancellation_reason": string | null,
"client_name": string,
"client_phone": string | null,
"created_at": string,
"ends_at": string,
"id": string,
"notes": string | null,
"owner_id": string,
"reminder_anchor_at": string,
"service_name": string,
"starts_at": string,
"status": Database["public"]['Enums']["appointment_status"],
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "appointments"
        isOneToOne: true
        isSetofReturn: false
      } },
"claim_reminder":
{ Args: { "p_appointment_id": string,"p_starts_at": string }; Returns: boolean
                           },
"create_appointment":
{ Args: { "p_client_name": string,"p_client_phone"?: string,"p_confirm_past"?: boolean,"p_ends_at": string,"p_notes"?: string,"p_service_name": string,"p_starts_at": string }; Returns: {
              "canceled_at": string | null,
"cancellation_reason": string | null,
"client_name": string,
"client_phone": string | null,
"created_at": string,
"ends_at": string,
"id": string,
"notes": string | null,
"owner_id": string,
"reminder_anchor_at": string,
"service_name": string,
"starts_at": string,
"status": Database["public"]['Enums']["appointment_status"],
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "appointments"
        isOneToOne: true
        isSetofReturn: false
      } },
"due_reminders":
{ Args: { "p_now"?: string }; Returns: {
              "appointment_id": string,"body": string,"owner_id": string,"starts_at": string,"title": string,"url": string
            }[]
                           },
"reactivate_appointment":
{ Args: { "p_id": string }; Returns: {
              "canceled_at": string | null,
"cancellation_reason": string | null,
"client_name": string,
"client_phone": string | null,
"created_at": string,
"ends_at": string,
"id": string,
"notes": string | null,
"owner_id": string,
"reminder_anchor_at": string,
"service_name": string,
"starts_at": string,
"status": Database["public"]['Enums']["appointment_status"],
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "appointments"
        isOneToOne: true
        isSetofReturn: false
      } },
"register_push_subscription":
{ Args: { "p_auth": string,"p_device_label"?: string,"p_endpoint": string,"p_p256dh": string }; Returns: string
                           },
"release_reminder":
{ Args: { "p_appointment_id": string,"p_starts_at": string }; Returns: undefined
                           },
"reschedule_appointment":
{ Args: { "p_confirm_past"?: boolean,"p_ends_at": string,"p_id": string,"p_starts_at": string }; Returns: {
              "canceled_at": string | null,
"cancellation_reason": string | null,
"client_name": string,
"client_phone": string | null,
"created_at": string,
"ends_at": string,
"id": string,
"notes": string | null,
"owner_id": string,
"reminder_anchor_at": string,
"service_name": string,
"starts_at": string,
"status": Database["public"]['Enums']["appointment_status"],
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "appointments"
        isOneToOne: true
        isSetofReturn: false
      } },
"set_appointment_status":
{ Args: { "p_id": string,"p_status": Database["public"]['Enums']["appointment_status"] }; Returns: {
              "canceled_at": string | null,
"cancellation_reason": string | null,
"client_name": string,
"client_phone": string | null,
"created_at": string,
"ends_at": string,
"id": string,
"notes": string | null,
"owner_id": string,
"reminder_anchor_at": string,
"service_name": string,
"starts_at": string,
"status": Database["public"]['Enums']["appointment_status"],
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "appointments"
        isOneToOne: true
        isSetofReturn: false
      } },
"set_business_hours":
{ Args: { "p_shifts": Json }; Returns: {
              "end_time": string,
"id": string,
"owner_id": string,
"start_time": string,
"weekday": number
            }[]
                          SetofOptions: {
        from: "*"
        to: "business_hours"
        isOneToOne: false
        isSetofReturn: true
      } },
"timemultirange":
{ Args: Record<PropertyKey, never>; Returns: unknown
                           },
"update_appointment_details":
{ Args: { "p_client_name": string,"p_client_phone": string,"p_id": string,"p_notes": string,"p_service_name": string }; Returns: {
              "canceled_at": string | null,
"cancellation_reason": string | null,
"client_name": string,
"client_phone": string | null,
"created_at": string,
"ends_at": string,
"id": string,
"notes": string | null,
"owner_id": string,
"reminder_anchor_at": string,
"service_name": string,
"starts_at": string,
"status": Database["public"]['Enums']["appointment_status"],
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "appointments"
        isOneToOne: true
        isSetofReturn: false
      } }
          }
          Enums: {
            "appointment_status": "agendado"|"concluido"|"cancelado"|"nao_compareceu","history_action": "criado"|"editado"|"remarcado"|"status_alterado"|"cancelado"|"reativado"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "appointment_status": ["agendado", "concluido", "cancelado", "nao_compareceu"],"history_action": ["criado", "editado", "remarcado", "status_alterado", "cancelado", "reativado"]
          }
        }
} as const
