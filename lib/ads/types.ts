// =============================================
// IA Gestora de Tráfego 360º — Tipos
// =============================================

// --- Campanhas ---

export type CampaignPlatform = 'meta' | 'google'

export type CampaignStatus = 'draft' | 'pending' | 'active' | 'paused' | 'completed' | 'error'

export interface AdCampaign {
    id: string
    property_id?: string
    platform: CampaignPlatform
    external_campaign_id?: string
    external_adset_id?: string
    external_ad_id?: string
    name: string
    status: CampaignStatus
    total_budget: number
    daily_budget?: number
    duration_days: number
    start_date?: string
    end_date?: string
    target_audience: Record<string, unknown>
    ai_auto_manage: boolean
    created_by?: string
    created_at: string
    updated_at: string
}

export interface CreateCampaignPayload {
    property_id?: string
    platform: CampaignPlatform
    name: string
    total_budget: number
    duration_days: number
    target_audience?: Record<string, unknown>
    ai_auto_manage?: boolean
}

// --- Criativos ---

export type CreativeType = 'image' | 'video'
export type CreativeStatus = 'pending' | 'uploading' | 'active' | 'rejected' | 'fatigued'

export interface AdCreative {
    id: string
    campaign_id: string
    type: CreativeType
    file_url: string
    external_asset_id?: string
    headline?: string
    description?: string
    thumbnail_url?: string
    status: CreativeStatus
    created_at: string
}

// --- Métricas ---

export interface MetricsSnapshot {
    id: string
    campaign_id: string
    snapshot_at: string
    impressions: number
    clicks: number
    ctr: number
    cpm: number
    cpc: number
    spend: number
    leads_count: number
    cost_per_lead?: number
    roas?: number
    thumbstop_ratio?: number
    video_views_3s?: number
    frequency?: number
    // --- Novos campos enriquecidos ---
    reach?: number
    unique_clicks?: number
    landing_page_views?: number
    link_clicks?: number
    outbound_clicks?: number
    inline_link_click_ctr?: number
    conversions?: number
    cost_per_result?: number
    messaging_conversations?: number
    post_engagements?: number
    // Rankings de qualidade (Meta ad relevance diagnostics)
    quality_ranking?: string       // e.g. 'ABOVE_AVERAGE_35', 'AVERAGE', 'BELOW_AVERAGE_10'
    engagement_rate_ranking?: string
    conversion_rate_ranking?: string
    // Retenção de vídeo
    video_p50?: number
    video_p75?: number
    video_p100?: number
    video_avg_watch_time?: number
}

// --- Alertas da IA ---

export type AlertType = 'insight' | 'warning' | 'action' | 'budget_alert'
export type AlertUrgency = 'low' | 'medium' | 'high' | 'critical'
export type AIAction = 'PAUSE_AD' | 'SCALE_BUDGET' | 'REDUCE_BUDGET' | 'SWAP_CREATIVE' | 'NONE'

export interface AICampaignAlert {
    id: string
    campaign_id: string
    creative_id?: string
    type: AlertType
    urgency: AlertUrgency
    action_taken?: AIAction
    message: string
    ai_reasoning?: string
    whatsapp_sent: boolean
    acknowledged: boolean
    created_at: string
}

// --- Resposta da IA ---

export interface AIAnalysisResponse {
    action: AIAction
    alert_message: string
    urgency: AlertUrgency
    reasoning?: string
    budget_adjustment?: {
        type: 'increase' | 'decrease'
        new_daily_budget: number
    }
}

// --- Log de Ações ---

export interface AIActionLogEntry {
    id: string
    campaign_id: string
    action: string
    old_value?: string
    new_value?: string
    reason?: string
    executed_at: string
}

// --- Contatos para Alertas WhatsApp ---

export interface AdminAlertContact {
    id: string
    name: string
    phone: string
    receive_traffic_alerts: boolean
    receive_budget_alerts: boolean
    receive_ai_actions: boolean
    min_urgency: AlertUrgency
    is_active: boolean
    created_at: string
}

// --- Meta Ads API ---

export interface MetaCampaignConfig {
    name: string
    objective: 'OUTCOME_LEADS' | 'OUTCOME_TRAFFIC' | 'OUTCOME_AWARENESS'
    daily_budget: number // em centavos (Meta usa centavos)
    status: 'PAUSED' | 'ACTIVE'
}

export interface MetaAdSetConfig {
    campaign_id: string
    name: string
    daily_budget: number
    targeting: {
        geo_locations?: { countries?: string[]; cities?: { key: string }[] }
        age_min?: number
        age_max?: number
        interests?: { id: string; name: string }[]
    }
    optimization_goal: 'LEAD_GENERATION' | 'LINK_CLICKS' | 'IMPRESSIONS'
}

export interface MetaInsightsResponse {
    impressions: string
    clicks: string
    ctr: string
    cpm: string
    cpc: string
    spend: string
    actions?: { action_type: string; value: string }[]
    video_thruplay_watched_actions?: { value: string }[]
    video_p25_watched_actions?: { value: string }[]
    frequency?: string
    // --- Novos campos ---
    reach?: string
    unique_clicks?: string
    outbound_clicks?: { outbound_click: string }[]
    inline_link_clicks?: string
    inline_link_click_ctr?: string
    conversions?: { action_type: string; value: string }[]
    cost_per_action_type?: { action_type: string; value: string }[]
    quality_ranking?: string
    engagement_rate_ranking?: string
    conversion_rate_ranking?: string
    video_p50_watched_actions?: { value: string }[]
    video_p75_watched_actions?: { value: string }[]
    video_p100_watched_actions?: { value: string }[]
    video_avg_time_watched_actions?: { value: string }[]
}

// --- Google Ads API ---

export interface GoogleCampaignConfig {
    name: string
    budget_amount_micros: number // Google usa micros (1 real = 1.000.000 micros)
    campaign_type: 'SEARCH' | 'DISPLAY' | 'VIDEO'
    status: 'ENABLED' | 'PAUSED'
}
