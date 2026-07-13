/**
 * Hand-written subset of the database types. Regenerate when schema changes:
 *
 *   npx supabase gen types typescript --project-id <ref> > src/lib/supabase/types.ts
 *
 * For Phase 0 we keep this manual to avoid blocking the build on a remote
 * schema-pull. Replace with the generated file once `supabase link` is set up.
 */

export type Currency = "vibe" | "gem";
export type AccountKind =
  | "user_wallet"
  | "system_mint"
  | "system_burn"
  | "system_revenue";
export type MarketStatus =
  | "open"
  | "closed"
  | "resolving"
  | "in_court"
  | "resolved"
  | "voided";
export type TradeSide = "yes" | "no";
export type ItemKind = "skin" | "shield" | "badge" | "animal" | "phenomenon";
export type Rarity = "common" | "rare" | "epic" | "legendary";
export type NotificationKind =
  | "bet_won"
  | "bet_lost"
  | "market_resolved"
  | "market_commented"
  | "comment_reply"
  | "streak_at_risk"
  | "resolution_proposed"
  | "dispute_opened"
  | "dispute_resolved";
export type DisputeStatus = "voting" | "overturned" | "upheld" | "expired";
export type MarketSource = "platform" | "community" | "polymarket_mirror";
export type MarketKind = "binary" | "categorical";
export type MarketCategory =
  | "politics"
  | "sports"
  | "crypto"
  | "tech"
  | "entertainment"
  | "finance"
  | "world"
  | "culture"
  | "other";

export const MARKET_CATEGORIES: MarketCategory[] = [
  "politics",
  "sports",
  "crypto",
  "tech",
  "entertainment",
  "finance",
  "world",
  "culture",
  "other",
];

export const CATEGORY_LABELS: Record<MarketCategory, string> = {
  politics: "Politics",
  sports: "Sports",
  crypto: "Crypto",
  tech: "Tech",
  entertainment: "Entertainment",
  finance: "Finance",
  world: "World",
  culture: "Culture",
  other: "Other",
};

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string | null;
          display_name: string;
          avatar_url: string | null;
          current_streak: number;
          longest_streak: number;
          last_active_date: string | null;
          predictions_scored: number;
          correct_predictions: number;
          brier_sum: number;
          is_pro: boolean;
          pro_expires_at: string | null;
          streak_shields: number;
          stripe_customer_id: string | null;
          push_notifications_enabled: boolean;
          referral_code: string | null;
          referred_by: string | null;
          email_digest_enabled: boolean;
          player_path: string;
          companion_name: string | null;
          vibe_pass_dismissed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username?: string | null;
          display_name: string;
          avatar_url?: string | null;
          current_streak?: number;
          longest_streak?: number;
          last_active_date?: string | null;
          is_pro?: boolean;
          pro_expires_at?: string | null;
          streak_shields?: number;
          player_path?: string;
        };
        Update: {
          username?: string | null;
          display_name?: string;
          avatar_url?: string | null;
          current_streak?: number;
          longest_streak?: number;
          last_active_date?: string | null;
          is_pro?: boolean;
          pro_expires_at?: string | null;
          streak_shields?: number;
          player_path?: string;
        };
        Relationships: [];
      };
      accounts: {
        Row: {
          id: string;
          kind: AccountKind;
          currency: Currency;
          owner_user_id: string | null;
          code: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          kind: AccountKind;
          currency: Currency;
          owner_user_id?: string | null;
          code?: string | null;
        };
        Update: never;
        Relationships: [];
      };
      ledger_transactions: {
        Row: {
          id: string;
          kind: string;
          external_ref: string | null;
          metadata: Record<string, unknown>;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          kind: string;
          external_ref?: string | null;
          metadata?: Record<string, unknown>;
          created_by?: string | null;
        };
        Update: never;
        Relationships: [];
      };
      ledger_entries: {
        Row: {
          id: string;
          transaction_id: string;
          account_id: string;
          amount: number;
          currency: Currency;
          created_at: string;
        };
        Insert: {
          id?: string;
          transaction_id: string;
          account_id: string;
          amount: number;
          currency: Currency;
        };
        Update: never;
        Relationships: [];
      };
      feature_flags: {
        Row: {
          key: string;
          enabled: boolean;
          description: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          key: string;
          enabled?: boolean;
          description?: string | null;
        };
        Update: {
          enabled?: boolean;
          description?: string | null;
        };
        Relationships: [];
      };
      game_player_ratings: {
        Row: {
          user_id: string;
          game_key: string;
          rating: number;
          games_played: number;
          wins: number;
          losses: number;
          draws: number;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          game_key: string;
          rating?: number;
          games_played?: number;
          wins?: number;
          losses?: number;
          draws?: number;
        };
        Update: {
          rating?: number;
          games_played?: number;
          wins?: number;
          losses?: number;
          draws?: number;
        };
        Relationships: [];
      };
      high_card_duels: {
        Row: {
          id: string;
          creator_id: string;
          opponent_id: string | null;
          stake: number;
          creator_card: number | null;
          opponent_card: number | null;
          status: string;
          winner_id: string | null;
          created_at: string;
          expires_at: string;
          settled_at: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      dice_duels: {
        Row: {
          id: string;
          creator_id: string;
          opponent_id: string | null;
          stake: number;
          creator_roll: number | null;
          opponent_roll: number | null;
          status: string;
          winner_id: string | null;
          created_at: string;
          expires_at: string;
          settled_at: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      poker_games: {
        Row: {
          id: string;
          creator_id: string;
          opponent_id: string | null;
          invited_user_id: string | null;
          stake: number;
          is_friendly: boolean;
          state: Record<string, unknown> | null;
          status: string;
          winner_id: string | null;
          creator_hand_rank: string | null;
          opponent_hand_rank: string | null;
          created_at: string;
          expires_at: string;
          settled_at: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      game_match_queue: {
        Row: {
          id: string;
          game_key: string;
          user_id: string;
          stake: number;
          joined_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      trivia_duels: {
        Row: {
          id: string;
          creator_id: string;
          opponent_id: string | null;
          stake: number;
          status: string;
          question_ids: string[] | null;
          creator_answers: number[] | null;
          opponent_answers: number[] | null;
          creator_score: number | null;
          opponent_score: number | null;
          winner_id: string | null;
          created_at: string;
          expires_at: string;
          settled_at: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      markets: {
        Row: {
          id: string;
          creator_id: string;
          question: string;
          description: string | null;
          status: MarketStatus;
          reserve_yes: number;
          reserve_no: number;
          subsidy: number;
          resolved_outcome: boolean | null;
          resolved_at: string | null;
          closes_at: string | null;
          created_at: string;
          category: MarketCategory;
          image_url: string | null;
          is_featured: boolean;
          outcome_yes_label: string;
          outcome_no_label: string;
          proposed_outcome: boolean | null;
          challenge_deadline: string | null;
          voting_ends_at: string | null;
          kind: MarketKind;
          lmsr_b: number | null;
          proposed_outcome_index: number | null;
          source: MarketSource;
          external_id: string | null;
          external_url: string | null;
          external_volume_usd: number | null;
          external_volume_24h_usd: number | null;
          external_synced_at: string | null;
          external_event_id: string | null;
          external_event_slug: string | null;
          external_event_title: string | null;
          external_tags: unknown;
          fast_asset: string | null;
          fast_interval_sec: number | null;
          strike_price: number | null;
          resolve_price: number | null;
          window_start: string | null;
          window_end: string | null;
          creator_bonus_paid: boolean;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      asset_price_ticks: {
        Row: {
          id: string;
          asset: string;
          price_usd: number;
          recorded_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      market_suggestion_votes: {
        Row: {
          suggestion_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          suggestion_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
      market_suggestions: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          description: string | null;
          category: MarketCategory;
          yes_label: string;
          no_label: string;
          status: "pending" | "approved" | "rejected" | "spawned";
          vote_count: number;
          market_id: string | null;
          admin_note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          description?: string | null;
          category?: MarketCategory;
          yes_label?: string;
          no_label?: string;
          status?: "pending" | "approved" | "rejected" | "spawned";
          vote_count?: number;
          market_id?: string | null;
          admin_note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: "pending" | "approved" | "rejected" | "spawned";
          vote_count?: number;
          market_id?: string | null;
          admin_note?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      onboarding_progress: {
        Row: {
          user_id: string;
          step: number;
          interests: string[];
          first_bet_at: string | null;
          first_bet_market_id: string | null;
          completed_at: string | null;
          skipped_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      analytics_events: {
        Row: {
          id: string;
          user_id: string | null;
          event_name: string;
          properties: Record<string, unknown>;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      push_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          user_agent: string | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      push_outbox: {
        Row: {
          id: string;
          notification_id: string;
          user_id: string;
          status: string;
          attempts: number;
          last_error: string | null;
          created_at: string;
          delivered_at: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      referral_rewards: {
        Row: {
          id: string;
          referrer_id: string;
          referee_id: string;
          reward_kind: string;
          vibe_amount: number;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      recurring_market_series: {
        Row: {
          id: string;
          creator_id: string;
          title: string;
          fast_asset: string;
          interval_sec: number;
          creator_fee_bps: number;
          category: MarketCategory;
          enabled: boolean;
          windows_spawned: number;
          created_at: string;
        };
        Insert: never;
        Update: {
          enabled?: boolean;
        };
        Relationships: [];
      };
      positions: {
        Row: {
          market_id: string;
          user_id: string;
          yes_shares: number;
          no_shares: number;
          total_cost: number;
          total_payout: number;
          total_proceeds: number;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      market_outcomes: {
        Row: {
          market_id: string;
          outcome_index: number;
          label: string;
          image_url: string | null;
          shares: number;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      categorical_positions: {
        Row: {
          market_id: string;
          user_id: string;
          outcome_index: number;
          shares: number;
          total_cost: number;
          total_payout: number;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      trades: {
        Row: {
          id: string;
          market_id: string;
          user_id: string;
          side: TradeSide | null;
          outcome_index: number | null;
          cost: number;
          shares: number;
          reserve_yes_after: number;
          reserve_no_after: number;
          ledger_transaction_id: string;
          entry_yes_prob: number | null;
          prediction_scored: boolean;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      shop_items: {
        Row: {
          id: string;
          slug: string;
          name: string;
          description: string | null;
          kind: ItemKind;
          rarity: Rarity;
          price_gems: number;
          price_vibe: number;
          is_active: boolean;
          image_url: string | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      locker_momentum: {
        Row: {
          user_id: string;
          momentum: number;
          super_until: string | null;
          case_chain: number;
          wheel_chain: number;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      locker_wheel_daily: {
        Row: {
          user_id: string;
          spin_date: string;
          spins_used: number;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      user_inventory: {
        Row: {
          id: string;
          user_id: string;
          item_id: string;
          acquired_at: string;
          is_equipped: boolean;
        };
        Insert: never;
        Update: { is_equipped?: boolean };
        Relationships: [
          {
            foreignKeyName: "user_inventory_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "shop_items";
            referencedColumns: ["id"];
          },
        ];
      };
      user_consumables: {
        Row: {
          user_id: string;
          slug: string;
          quantity: number;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      gem_bundles: {
        Row: {
          id: string;
          slug: string;
          name: string;
          gems: number;
          price_usd_cents: number;
          is_active: boolean;
          display_order: number;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      market_comments: {
        Row: {
          id: string;
          market_id: string;
          user_id: string;
          body: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          market_id: string;
          user_id: string;
          body: string;
        };
        Update: never;
        Relationships: [];
      };
      stream_watch_comments: {
        Row: {
          id: string;
          stream_provider: string;
          stream_external_id: string;
          user_id: string;
          body: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          stream_provider: string;
          stream_external_id: string;
          user_id: string;
          body: string;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          kind: NotificationKind;
          title: string;
          body: string | null;
          data: Record<string, unknown>;
          dedupe_key: string;
          is_read: boolean;
          read_at: string | null;
          created_at: string;
        };
        Insert: never;
        Update: { is_read?: boolean; read_at?: string | null };
        Relationships: [];
      };
      disputes: {
        Row: {
          id: string;
          market_id: string;
          initiator_id: string;
          claimed_outcome: boolean;
          proposed_outcome: boolean;
          claimed_outcome_index: number | null;
          proposed_outcome_index: number | null;
          stake_amount: number;
          reasoning: string | null;
          status: DisputeStatus;
          voting_starts_at: string;
          voting_ends_at: string;
          votes_overturn: number;
          votes_uphold: number;
          resolved_at: string | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      court_votes: {
        Row: {
          id: string;
          dispute_id: string;
          voter_id: string;
          overturn: boolean;
          vote_number: number;
          vibe_cost: number;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      user_achievements: {
        Row: {
          user_id: string;
          achievement_id: string;
          unlocked_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      battle_pass_seasons: {
        Row: {
          id: string;
          name: string;
          starts_at: string;
          ends_at: string;
          max_tier: number;
          xp_per_tier: number;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      user_battle_pass: {
        Row: {
          user_id: string;
          season_id: string;
          xp: number;
          premium_unlocked: boolean;
          claimed_free: number[];
          claimed_premium: number[];
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Views: {
      user_balances: {
        Row: {
          user_id: string | null;
          currency: Currency | null;
          balance: number | null;
        };
        Relationships: [];
      };
      markets_view: {
        Row: {
          id: string;
          creator_id: string;
          question: string;
          description: string | null;
          status: MarketStatus;
          reserve_yes: number;
          reserve_no: number;
          subsidy: number;
          resolved_outcome: boolean | null;
          resolved_at: string | null;
          closes_at: string | null;
          created_at: string;
          category: MarketCategory;
          image_url: string | null;
          is_featured: boolean;
          outcome_yes_label: string;
          outcome_no_label: string;
          proposed_outcome: boolean | null;
          challenge_deadline: string | null;
          voting_ends_at: string | null;
          kind: MarketKind;
          source: MarketSource;
          external_id: string | null;
          external_url: string | null;
          external_volume_usd: number | null;
          external_volume_24h_usd: number | null;
          external_synced_at: string | null;
          external_event_id: string | null;
          external_event_slug: string | null;
          external_event_title: string | null;
          external_tags: unknown;
          fast_asset: string | null;
          fast_interval_sec: number | null;
          strike_price: number | null;
          resolve_price: number | null;
          window_start: string | null;
          window_end: string | null;
          creator_bonus_paid: boolean;
          yes_price: number;
          recurring_series_id: string | null;
          creator_fee_bps: number;
          yes_price_24h_ago: number;
          volume: number;
          trade_count: number;
          volume_24h: number;
        };
        Relationships: [];
      };
      categorical_market_view: {
        Row: {
          id: string;
          creator_id: string;
          question: string;
          description: string | null;
          status: MarketStatus;
          category: MarketCategory;
          closes_at: string | null;
          created_at: string;
          lmsr_b: number;
          image_url: string | null;
          proposed_outcome_index: number | null;
          challenge_deadline: string | null;
          kind: MarketKind;
          outcomes: unknown;
          volume: number;
          trade_count: number;
        };
        Relationships: [];
      };
    };
    Functions: {
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      create_market: {
        Args: {
          p_question: string;
          p_description: string | null;
          p_subsidy: number;
          p_closes_at?: string | null;
          p_category?: MarketCategory;
          p_outcome_yes_label?: string;
          p_outcome_no_label?: string;
        };
        Returns: string;
      };
      place_trade: {
        Args: {
          p_market_id: string;
          p_side: TradeSide;
          p_cost: number;
        };
        Returns: {
          trade_id: string;
          shares_received: number;
          reserve_yes_after: number;
          reserve_no_after: number;
        }[];
      };
      sell_shares: {
        Args: {
          p_market_id: string;
          p_side: TradeSide;
          p_shares: number;
        };
        Returns: {
          trade_id: string;
          proceeds: number;
          reserve_yes_after: number;
          reserve_no_after: number;
        }[];
      };
      quick_exit_shares: {
        Args: {
          p_market_id: string;
          p_side: TradeSide;
          p_shares: number;
        };
        Returns: {
          trade_id: string;
          proceeds: number;
          fee: number;
          cost_basis: number;
        }[];
      };
      resolve_market: {
        Args: {
          p_market_id: string;
          p_outcome: boolean;
        };
        Returns: undefined;
      };
      grant_locker_cosmetics: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      get_locker_momentum: {
        Args: Record<PropertyKey, never>;
        Returns: {
          momentum: number;
          super_until: string | null;
          super_active: boolean;
          super_seconds_left: number;
          case_chain: number;
          wheel_chain: number;
          affinity_label: string;
        }[];
      };
      open_locker_crate: {
        Args: { p_stake?: number };
        Returns: {
          label: string;
          payout: number;
          net: number;
          new_balance: number;
          momentum: number;
          momentum_delta: number;
          super_active: boolean;
          super_seconds_left: number;
          payout_multiplier: number;
          affinity_label: string;
          is_jackpot: boolean;
        }[];
      };
      spin_locker_wheel: {
        Args: { p_paid_stake?: number; p_use_adrenaline_token?: boolean };
        Returns: {
          segment_index: number;
          label: string;
          payout: number;
          cost: number;
          net: number;
          new_balance: number;
          free_spin: boolean;
          momentum: number;
          momentum_delta: number;
          super_active: boolean;
          super_seconds_left: number;
          payout_multiplier: number;
          affinity_label: string;
          is_jackpot: boolean;
          adrenaline_spin: boolean;
        }[];
      };
      spend_gems_for_item: {
        Args: { p_item_id: string };
        Returns: string;
      };
      spend_vibe_for_item: {
        Args: { p_item_id: string };
        Returns: string;
      };
      leaderboard: {
        Args: { p_limit?: number };
        Returns: {
          rank: number;
          user_id: string;
          display_name: string;
          total_cost: number;
          total_payout: number;
          total_proceeds: number;
          profit: number;
          markets_traded: number;
        }[];
      };
      mark_notifications_read: {
        Args: { p_notification_ids?: string[] | null };
        Returns: number;
      };
      unread_notification_count: {
        Args: Record<string, never>;
        Returns: number;
      };
      propose_resolution: {
        Args: { p_market_id: string; p_outcome: boolean };
        Returns: undefined;
      };
      open_dispute: {
        Args: {
          p_market_id: string;
          p_reasoning: string | null;
          p_claimed_outcome_index?: number | null;
        };
        Returns: string;
      };
      cast_vote: {
        Args: { p_dispute_id: string; p_overturn: boolean };
        Returns: undefined;
      };
      court_tick: {
        Args: { p_limit?: number };
        Returns: number;
      };
      admin_seed_official_markets: {
        Args: Record<string, never>;
        Returns: number;
      };
      upsert_polymarket_mirror: {
        Args: {
          p_external_id: string;
          p_question: string;
          p_description: string | null;
          p_yes_price: number;
          p_closes_at: string | null;
          p_category: string;
          p_yes_label: string;
          p_no_label: string;
          p_external_url: string | null;
          p_external_vol: number | null;
          p_external_vol_24h: number | null;
          p_image_url: string | null;
        };
        Returns: string;
      };
      create_categorical_market: {
        Args: {
          p_question: string;
          p_description: string | null;
          p_outcome_labels: string[];
          p_subsidy: number;
          p_closes_at?: string | null;
          p_category?: MarketCategory;
          p_image_url?: string | null;
        };
        Returns: string;
      };
      place_categorical_trade: {
        Args: {
          p_market_id: string;
          p_outcome_index: number;
          p_cost: number;
        };
        Returns: number;
      };
      propose_resolution_categorical: {
        Args: { p_market_id: string; p_outcome_index: number };
        Returns: undefined;
      };
      record_daily_activity: {
        Args: Record<string, never>;
        Returns: Record<string, unknown>;
      };
      get_public_profile: {
        Args: { p_username: string };
        Returns: Record<string, unknown> | null;
      };
      check_achievements: {
        Args: { p_user_id?: string };
        Returns: number;
      };
      bootstrap_market_catalog: {
        Args: Record<string, never>;
        Returns: Record<string, unknown>;
      };
      refresh_polymarket_mirrors: {
        Args: { p_payload: unknown; p_force?: boolean };
        Returns: number;
      };
      get_market_catalog_stats: {
        Args: Record<string, never>;
        Returns: Record<string, unknown>;
      };
      get_mirror_catalog_sidebar: {
        Args: Record<string, never>;
        Returns: Record<string, unknown>;
      };
      record_fast_market_tick: {
        Args: { p_prices: unknown };
        Returns: Record<string, unknown>;
      };
      maybe_grant_creator_bonus: {
        Args: { p_market_id: string };
        Returns: boolean;
      };
      finalize_polymarket_mirrors: {
        Args: { p_updates: unknown };
        Returns: number;
      };
      create_recurring_series: {
        Args: {
          p_title: string;
          p_asset: string;
          p_interval_sec: number;
          p_creator_fee_bps?: number;
        };
        Returns: string;
      };
      submit_market_suggestion: {
        Args: {
          p_title: string;
          p_description?: string | null;
          p_category?: string;
          p_yes_label?: string;
          p_no_label?: string;
        };
        Returns: string;
      };
      vote_market_suggestion: {
        Args: { p_suggestion_id: string };
        Returns: Record<string, unknown>;
      };
      get_creator_stats: {
        Args: { p_user_id?: string };
        Returns: Record<string, unknown>;
      };
      get_creator_top_markets: {
        Args: { p_user_id?: string; p_limit?: number };
        Returns: {
          market_id: string;
          question: string;
          status: MarketStatus;
          volume: number;
          fee_earned: number;
          is_recurring: boolean;
        }[];
      };
      get_creator_recurring_series: {
        Args: { p_user_id?: string; p_limit?: number };
        Returns: {
          series_id: string;
          title: string;
          fast_asset: string;
          interval_sec: number;
          enabled: boolean;
          windows_spawned: number;
          creator_fee_bps: number;
        }[];
      };
      creator_leaderboard: {
        Args: { p_limit?: number };
        Returns: {
          rank: number;
          user_id: string;
          display_name: string;
          total_volume: number;
          fee_earned: number;
          markets_created: number;
          series_count: number;
        }[];
      };
      admin_resolve_suggestion: {
        Args: {
          p_suggestion_id: string;
          p_action: string;
          p_note?: string | null;
        };
        Returns: undefined;
      };
      admin_spawn_suggested_market: {
        Args: {
          p_suggestion_id: string;
          p_subsidy?: number;
        };
        Returns: string;
      };
      get_accuracy_stats: {
        Args: { p_user_id?: string };
        Returns: Record<string, unknown>;
      };
      accuracy_leaderboard: {
        Args: { p_limit?: number };
        Returns: {
          rank: number;
          user_id: string;
          display_name: string;
          predictions_scored: number;
          accuracy_pct: number;
          avg_brier: number;
        }[];
      };
      get_onboarding_state: {
        Args: Record<string, never>;
        Returns: Record<string, unknown>;
      };
      get_vibe_pass_progress: {
        Args: Record<string, never>;
        Returns: Record<string, unknown>;
      };
      get_my_consumables: {
        Args: Record<string, never>;
        Returns: Record<string, unknown>;
      };
      get_legacy_cathedral: {
        Args: { p_user_id?: string };
        Returns: Record<string, unknown>;
      };
      dismiss_vibe_pass: {
        Args: Record<string, never>;
        Returns: Record<string, unknown>;
      };
      set_companion_name: {
        Args: { p_name: string };
        Returns: Record<string, unknown>;
      };
      get_companion_expedition_status: {
        Args: Record<string, never>;
        Returns: Record<string, unknown>;
      };
      start_companion_expedition: {
        Args: Record<string, never>;
        Returns: Record<string, unknown>;
      };
      claim_companion_expedition: {
        Args: Record<string, never>;
        Returns: Record<string, unknown>;
      };
      save_onboarding_interests: {
        Args: { p_interests: string[] };
        Returns: undefined;
      };
      save_onboarding_path: {
        Args: { p_path: string };
        Returns: undefined;
      };
      set_player_path: {
        Args: { p_path: string };
        Returns: undefined;
      };
      complete_onboarding: {
        Args: { p_skip?: boolean };
        Returns: undefined;
      };
      track_event: {
        Args: {
          p_event_name: string;
          p_properties?: Record<string, unknown>;
        };
        Returns: undefined;
      };
      get_analytics_summary: {
        Args: { p_days?: number };
        Returns: {
          event_name: string;
          event_count: number;
          unique_users: number;
        }[];
      };
      get_recent_analytics_events: {
        Args: { p_limit?: number; p_event_name?: string | null };
        Returns: {
          id: string;
          user_id: string | null;
          event_name: string;
          properties: Record<string, unknown>;
          created_at: string;
        }[];
      };
      export_analytics_events: {
        Args: { p_since?: string; p_limit?: number };
        Returns: {
          id: string;
          user_id: string | null;
          event_name: string;
          properties: Record<string, unknown>;
          created_at: string;
        }[];
      };
      save_push_subscription: {
        Args: {
          p_endpoint: string;
          p_p256dh: string;
          p_auth: string;
          p_user_agent?: string | null;
        };
        Returns: undefined;
      };
      remove_push_subscription: {
        Args: { p_endpoint: string };
        Returns: undefined;
      };
      set_push_notifications_enabled: {
        Args: { p_enabled: boolean };
        Returns: undefined;
      };
      get_pending_push_jobs: {
        Args: { p_limit?: number };
        Returns: {
          outbox_id: string;
          notification_id: string;
          title: string;
          body: string;
          url: string;
        }[];
      };
      mark_push_job: {
        Args: {
          p_outbox_id: string;
          p_status: string;
          p_error?: string | null;
        };
        Returns: undefined;
      };
      apply_referral_code: {
        Args: { p_code: string };
        Returns: Record<string, unknown>;
      };
      try_referral_first_bet_reward: {
        Args: Record<string, never>;
        Returns: Record<string, unknown>;
      };
      get_my_referral_stats: {
        Args: Record<string, never>;
        Returns: Record<string, unknown>;
      };
      get_weekly_digest: {
        Args: Record<string, never>;
        Returns: Record<string, unknown>;
      };
      set_email_digest_enabled: {
        Args: { p_enabled: boolean };
        Returns: undefined;
      };
      get_daily_hustle: {
        Args: { p_task_kind?: string | null };
        Returns: {
          task_id: string;
          title: string;
          description: string;
          target: number;
          reward_vibe: number;
          progress: number;
          completed: boolean;
          claimed: boolean;
          task_kind: string;
          metric: string;
          min_hustle_tier: number;
          tier_locked: boolean;
        }[];
      };
      get_hustle_oracle: {
        Args: Record<string, never>;
        Returns: Record<string, unknown>;
      };
      submit_spark_hustle_progress: {
        Args: { p_task_id: string; p_amount?: number };
        Returns: Record<string, unknown>;
      };
      claim_daily_hustle_reward: {
        Args: { p_task_id: string };
        Returns: number;
      };
      get_hustle_wallet: {
        Args: Record<string, never>;
        Returns: Record<string, unknown>;
      };
      request_hustle_transfer: {
        Args: { p_direction: string; p_amount: number };
        Returns: Record<string, unknown>;
      };
      cancel_hustle_transfer: {
        Args: { p_transfer_id: string };
        Returns: Record<string, unknown>;
      };
      get_hustle_marketplace: {
        Args: Record<string, never>;
        Returns: Record<string, unknown>;
      };
      post_hustle_gig: {
        Args: {
          p_title: string;
          p_description: string;
          p_category: string;
          p_reward_vibe: number;
          p_min_hustle_tier?: number;
          p_slots?: number;
          p_proof_instructions?: string | null;
        };
        Returns: Record<string, unknown>;
      };
      claim_hustle_gig: {
        Args: { p_gig_id: string };
        Returns: Record<string, unknown>;
      };
      submit_hustle_gig_proof: {
        Args: {
          p_submission_id: string;
          p_proof_text: string;
          p_proof_url?: string | null;
        };
        Returns: Record<string, unknown>;
      };
      review_hustle_gig_submission: {
        Args: {
          p_submission_id: string;
          p_action: string;
          p_reason?: string | null;
        };
        Returns: Record<string, unknown>;
      };
      cancel_hustle_gig: {
        Args: { p_gig_id: string };
        Returns: Record<string, unknown>;
      };
      get_hustle_equity: {
        Args: Record<string, never>;
        Returns: Record<string, unknown>;
      };
      convert_hustle_cash_to_shares: {
        Args: { p_hustle_cash: number };
        Returns: Record<string, unknown>;
      };
      redeem_hustle_shares_to_cash: {
        Args: { p_shares: number };
        Returns: Record<string, unknown>;
      };
      get_hustle_governance: {
        Args: Record<string, never>;
        Returns: Record<string, unknown>;
      };
      cast_hustle_governance_vote: {
        Args: { p_proposal_id: string; p_support: boolean };
        Returns: Record<string, unknown>;
      };
      submit_hustle_governance_proposal: {
        Args: { p_title: string; p_description: string; p_category?: string };
        Returns: Record<string, unknown>;
      };
      get_hustle_wellness: {
        Args: Record<string, never>;
        Returns: Record<string, unknown>;
      };
      enable_hustle_recovery: {
        Args: { p_days: number };
        Returns: Record<string, unknown>;
      };
      set_hustle_region: {
        Args: { p_region: string };
        Returns: Record<string, unknown>;
      };
      get_product_metrics: {
        Args: { p_days?: number };
        Returns: Record<string, unknown>;
      };
      get_activity_feed: {
        Args: { p_limit?: number };
        Returns: {
          id: string;
          kind: string;
          user_id: string | null;
          market_id: string | null;
          display_name: string | null;
          market_question: string | null;
          amount: number;
          side: string | null;
          created_at: string;
        }[];
      };
      get_weekly_quests: {
        Args: Record<string, never>;
        Returns: {
          quest_id: string;
          title: string;
          description: string;
          target: number;
          reward_vibe: number;
          progress: number;
          completed: boolean;
          claimed: boolean;
        }[];
      };
      claim_quest_reward: {
        Args: { p_quest_id: string };
        Returns: number;
      };
      get_active_tournament: {
        Args: Record<string, never>;
        Returns: Record<string, unknown>;
      };
      get_tournament_leaderboard: {
        Args: { p_limit?: number };
        Returns: {
          rank: number;
          user_id: string;
          display_name: string;
          volume: number;
        }[];
      };
      create_duel: {
        Args: {
          p_market_id: string;
          p_side: TradeSide;
          p_stake: number;
          p_opponent_username?: string | null;
        };
        Returns: string;
      };
      accept_duel: {
        Args: { p_duel_id: string };
        Returns: undefined;
      };
      cancel_duel: {
        Args: { p_duel_id: string };
        Returns: undefined;
      };
      decline_duel: {
        Args: { p_duel_id: string };
        Returns: undefined;
      };
      get_open_duels: {
        Args: { p_limit?: number };
        Returns: {
          id: string;
          challenger_id: string;
          challenger_name: string;
          opponent_id: string | null;
          opponent_name: string | null;
          market_id: string;
          market_question: string;
          challenger_side: TradeSide;
          stake: number;
          status: string;
          created_at: string;
          expires_at: string;
          spectator_market_id: string | null;
        }[];
      };
      get_my_duels: {
        Args: { p_limit?: number };
        Returns: {
          id: string;
          challenger_id: string;
          challenger_name: string;
          opponent_id: string | null;
          opponent_name: string | null;
          market_id: string;
          market_question: string;
          challenger_side: TradeSide;
          opponent_side: TradeSide | null;
          stake: number;
          status: string;
          winner_id: string | null;
          created_at: string;
          accepted_at: string | null;
          settled_at: string | null;
          spectator_market_id: string | null;
        }[];
      };
      get_active_spectator_duels: {
        Args: { p_limit?: number };
        Returns: {
          duel_id: string;
          challenger_name: string;
          opponent_name: string;
          market_question: string;
          underlying_market_id: string;
          spectator_market_id: string;
          stake: number;
          accepted_at: string | null;
        }[];
      };
      get_duel: {
        Args: { p_duel_id: string };
        Returns: Record<string, unknown>;
      };
      create_live_event: {
        Args: {
          p_title: string;
          p_description?: string | null;
          p_category?: string;
          p_stream_url?: string | null;
          p_starts_at?: string | null;
          p_yes_label?: string;
          p_no_label?: string;
          p_enable_bet?: boolean;
        };
        Returns: string;
      };
      set_live_event_status: {
        Args: { p_event_id: string; p_status: string };
        Returns: undefined;
      };
      get_live_events: {
        Args: { p_limit?: number };
        Returns: {
          id: string;
          creator_id: string;
          creator_name: string;
          title: string;
          description: string | null;
          category: string;
          stream_url: string | null;
          status: string;
          betting_market_id: string | null;
          duel_id: string | null;
          paper_duel_id: string | null;
          starts_at: string | null;
          ends_at: string | null;
          created_at: string;
        }[];
      };
      get_live_event: {
        Args: { p_event_id: string };
        Returns: Record<string, unknown>;
      };
      create_stream_watch_bet: {
        Args: {
          p_provider: string;
          p_external_id: string;
          p_question: string;
          p_yes_label?: string;
          p_no_label?: string;
          p_stream_title?: string | null;
        };
        Returns: string;
      };
      get_stream_watch_bets: {
        Args: {
          p_provider: string;
          p_external_id: string;
          p_limit?: number;
        };
        Returns: {
          bet_id: string;
          market_id: string;
          question: string;
          yes_label: string;
          no_label: string;
          creator_name: string;
          created_at: string;
          market_status: string;
          reserve_yes: number;
          reserve_no: number;
          yes_price: number;
        }[];
      };
      get_stream_watch_comments: {
        Args: {
          p_provider: string;
          p_external_id: string;
          p_limit?: number;
        };
        Returns: {
          id: string;
          body: string;
          author_name: string;
          created_at: string;
        }[];
      };
      link_live_event_game: {
        Args: {
          p_event_id: string;
          p_duel_id?: string | null;
          p_paper_duel_id?: string | null;
        };
        Returns: undefined;
      };
      play_coin_flip: {
        Args: { p_side: string; p_stake: number };
        Returns: { won: boolean; payout: number; flip_side: string }[];
      };
      play_coin_flip_vs_bot: {
        Args: { p_side: string };
        Returns: { won: boolean; payout: number; flip_side: string; bot_side: string }[];
      };
      create_dice_duel: {
        Args: { p_stake: number };
        Returns: string;
      };
      accept_dice_duel: {
        Args: { p_duel_id: string };
        Returns: {
          creator_roll: number;
          opponent_roll: number;
          winner_id: string;
          payout: number;
        }[];
      };
      play_dice_vs_bot: {
        Args: { p_stake: number };
        Returns: {
          creator_roll: number;
          opponent_roll: number;
          winner_id: string;
          payout: number;
          bot_name: string;
        }[];
      };
      start_connect4_vs_bot: {
        Args: { p_friendly?: boolean; p_stake?: number };
        Returns: string;
      };
      play_connect4_bot_move: {
        Args: { p_game_id: string };
        Returns: { winner_id: string | null; is_draw: boolean; col_played: number }[];
      };
      start_checkers_vs_bot: {
        Args: { p_friendly?: boolean; p_stake?: number };
        Returns: string;
      };
      start_go_vs_bot: {
        Args: { p_friendly?: boolean; p_stake?: number };
        Returns: string;
      };
      start_shogi_vs_bot: {
        Args: { p_friendly?: boolean; p_stake?: number };
        Returns: string;
      };
      start_poker_vs_bot: {
        Args: { p_state: Record<string, unknown>; p_friendly?: boolean; p_stake?: number };
        Returns: string;
      };
      play_trivia_vs_bot: {
        Args: { p_stake?: number };
        Returns: {
          your_score: number;
          bot_score: number;
          winner_id: string;
          payout: number;
          bot_name: string;
        }[];
      };
      play_liars_dice_vs_bot: {
        Args: { p_stake?: number };
        Returns: {
          winner_id: string;
          payout: number;
          bot_name: string;
          you_won: boolean;
        }[];
      };
      play_lightning_duel_vs_bot: {
        Args: { p_stake?: number; p_side?: string };
        Returns: {
          winner_id: string;
          payout: number;
          bot_name: string;
          strike_price: number;
          settle_price: number;
        }[];
      };
      play_plinko: {
        Args: { p_stake: number; p_risk?: string };
        Returns: {
          slot_index: number;
          multiplier: number;
          payout: number;
          net: number;
          new_balance: number;
        }[];
      };
      spin_lucky_slots: {
        Args: { p_stake?: number };
        Returns: {
          reel1: string;
          reel2: string;
          reel3: string;
          line_payout: number;
          scratcher_won: boolean;
          ticket_id: string | null;
          net: number;
          new_balance: number;
        }[];
      };
      reveal_lucky_scratcher: {
        Args: { p_ticket_id: string };
        Returns: { prize: number; new_balance: number }[];
      };
      get_pending_scratchers: {
        Args: Record<string, never>;
        Returns: { id: string; prize: number; created_at: string }[];
      };
      cancel_dice_duel: {
        Args: { p_duel_id: string };
        Returns: undefined;
      };
      get_open_dice_duels: {
        Args: { p_limit?: number };
        Returns: {
          id: string;
          creator_id: string;
          creator_name: string;
          stake: number;
          created_at: string;
          expires_at: string;
        }[];
      };
      create_rps_duel: {
        Args: {
          p_stake: number;
          p_move: string;
          p_invite_code?: string | null;
          p_friendly?: boolean;
        };
        Returns: string;
      };
      accept_rps_duel: {
        Args: { p_duel_id: string; p_move: string };
        Returns: {
          creator_move: string;
          opponent_move: string;
          winner_id: string | null;
          payout: number;
        }[];
      };
      play_rps_vs_bot: {
        Args: { p_stake: number; p_move: string };
        Returns: {
          creator_move: string;
          opponent_move: string;
          winner_id: string | null;
          payout: number;
          bot_name: string;
        }[];
      };
      cancel_rps_duel: {
        Args: { p_duel_id: string };
        Returns: undefined;
      };
      get_open_rps_duels: {
        Args: { p_limit?: number };
        Returns: {
          id: string;
          creator_id: string;
          creator_name: string;
          stake: number;
          is_friendly: boolean;
          invited_user_id: string | null;
          created_at: string;
          expires_at: string;
        }[];
      };
      create_high_card_duel: {
        Args: {
          p_stake: number;
          p_invite_code?: string | null;
          p_friendly?: boolean;
        };
        Returns: string;
      };
      accept_high_card_duel: {
        Args: { p_duel_id: string };
        Returns: {
          creator_card: number;
          opponent_card: number;
          winner_id: string;
          payout: number;
        }[];
      };
      play_high_card_vs_bot: {
        Args: { p_stake: number };
        Returns: {
          creator_card: number;
          opponent_card: number;
          winner_id: string;
          payout: number;
          bot_name: string;
        }[];
      };
      get_platform_bot_id: {
        Args: Record<string, never>;
        Returns: string;
      };
      start_chess_vs_bot: {
        Args: { p_friendly?: boolean; p_stake?: number };
        Returns: string;
      };
      apply_chess_state_for_bot: {
        Args: {
          p_game_id: string;
          p_fen: string;
          p_next_turn_id: string | null;
          p_status: string;
          p_winner_id: string | null;
          p_result?: string | null;
        };
        Returns: undefined;
      };
      cancel_high_card_duel: {
        Args: { p_duel_id: string };
        Returns: undefined;
      };
      get_open_high_card_duels: {
        Args: { p_limit?: number };
        Returns: {
          id: string;
          creator_id: string;
          creator_name: string;
          stake: number;
          is_friendly: boolean;
          invited_user_id: string | null;
          created_at: string;
          expires_at: string;
        }[];
      };
      join_game_match_queue: {
        Args: { p_game_key: string; p_stake: number };
        Returns: { matched: boolean; duel_id: string | null; role: string }[];
      };
      leave_game_match_queue: {
        Args: { p_game_key: string };
        Returns: undefined;
      };
      get_game_leaderboard: {
        Args: { p_game_key: string; p_limit?: number };
        Returns: {
          user_id: string;
          display_name: string;
          rating: number;
          wins: number;
          losses: number;
          games_played: number;
        }[];
      };
      create_lightning_duel: {
        Args: {
          p_side: string;
          p_stake: number;
          p_duration_sec?: number;
          p_invite_code?: string | null;
          p_friendly?: boolean;
        };
        Returns: string;
      };
      accept_lightning_duel: {
        Args: { p_duel_id: string; p_btc_price: number };
        Returns: undefined;
      };
      cancel_lightning_duel: {
        Args: { p_duel_id: string };
        Returns: undefined;
      };
      tick_lightning_duels: {
        Args: { p_btc_price: number };
        Returns: number;
      };
      get_open_lightning_duels: {
        Args: { p_limit?: number };
        Returns: {
          id: string;
          creator_id: string;
          creator_name: string;
          stake: number;
          is_friendly: boolean;
          invited_user_id: string | null;
          creator_side: string;
          duration_sec: number;
          created_at: string;
        }[];
      };
      get_lightning_duel: {
        Args: { p_duel_id: string };
        Returns: {
          id: string;
          creator_id: string;
          creator_name: string;
          opponent_id: string | null;
          opponent_name: string | null;
          stake: number;
          creator_side: string;
          duration_sec: number;
          status: string;
          strike_price: number | null;
          end_price: number | null;
          winner_id: string | null;
          started_at: string | null;
          ends_at: string | null;
          settled_at: string | null;
        }[];
      };
      create_trivia_duel: {
        Args: {
          p_stake: number;
          p_invite_code?: string | null;
          p_friendly?: boolean;
        };
        Returns: string;
      };
      accept_trivia_duel: {
        Args: { p_duel_id: string };
        Returns: string[];
      };
      submit_trivia_answers: {
        Args: { p_duel_id: string; p_answers: number[] };
        Returns: {
          creator_score: number | null;
          opponent_score: number | null;
          winner_id: string | null;
          payout: number | null;
        }[];
      };
      cancel_trivia_duel: {
        Args: { p_duel_id: string };
        Returns: undefined;
      };
      get_open_trivia_duels: {
        Args: { p_limit?: number };
        Returns: {
          id: string;
          creator_id: string;
          creator_name: string;
          stake: number;
          is_friendly: boolean;
          invited_user_id: string | null;
          created_at: string;
        }[];
      };
      get_trivia_questions_for_duel: {
        Args: { p_duel_id: string };
        Returns: {
          question_id: string;
          question: string;
          options: unknown;
          question_num: number;
        }[];
      };
      create_paper_duel: {
        Args: {
          p_creator_asset: string;
          p_duration_sec: number;
          p_stake: number;
        };
        Returns: string;
      };
      accept_paper_duel: {
        Args: {
          p_duel_id: string;
          p_opponent_asset: string;
          p_start_prices: Record<string, unknown>[];
        };
        Returns: undefined;
      };
      cancel_paper_duel: {
        Args: { p_duel_id: string };
        Returns: undefined;
      };
      paper_duel_tick: {
        Args: { p_prices: Record<string, unknown>[] };
        Returns: Record<string, unknown>;
      };
      get_open_paper_duels: {
        Args: { p_limit?: number };
        Returns: {
          id: string;
          creator_id: string;
          creator_name: string;
          creator_asset: string;
          duration_sec: number;
          stake: number;
          created_at: string;
          expires_at: string;
        }[];
      };
      get_active_paper_duels: {
        Args: { p_limit?: number };
        Returns: {
          id: string;
          creator_name: string;
          opponent_name: string;
          creator_asset: string;
          opponent_asset: string;
          duration_sec: number;
          stake: number;
          creator_start_price: number;
          opponent_start_price: number;
          creator_return_pct: number | null;
          opponent_return_pct: number | null;
          started_at: string;
          ends_at: string;
        }[];
      };
      get_my_paper_duels: {
        Args: { p_limit?: number };
        Returns: {
          id: string;
          creator_id: string;
          creator_name: string;
          opponent_id: string | null;
          opponent_name: string | null;
          creator_asset: string;
          opponent_asset: string | null;
          duration_sec: number;
          stake: number;
          status: string;
          creator_return_pct: number | null;
          opponent_return_pct: number | null;
          winner_id: string | null;
          created_at: string;
          started_at: string | null;
          ends_at: string | null;
          settled_at: string | null;
        }[];
      };
      get_paper_duel: {
        Args: { p_duel_id: string };
        Returns: Record<string, unknown>;
      };
      create_guild: {
        Args: {
          p_name: string;
          p_tag: string;
          p_description?: string | null;
        };
        Returns: string;
      };
      join_guild: {
        Args: { p_slug: string };
        Returns: string;
      };
      leave_guild: {
        Args: Record<string, never>;
        Returns: undefined;
      };
      disband_guild: {
        Args: Record<string, never>;
        Returns: undefined;
      };
      get_my_guild: {
        Args: Record<string, never>;
        Returns: Record<string, unknown>;
      };
      get_guild_by_slug: {
        Args: { p_slug: string };
        Returns: Record<string, unknown>;
      };
      get_guild_quest_status: {
        Args: Record<string, never>;
        Returns: Record<string, unknown>;
      };
      claim_guild_quest_reward: {
        Args: Record<string, never>;
        Returns: Record<string, unknown>;
      };
      contribute_to_guild_pot: {
        Args: { p_amount: number };
        Returns: Record<string, unknown>;
      };
      guild_leaderboard: {
        Args: { p_limit?: number };
        Returns: {
          rank: number;
          guild_id: string;
          name: string;
          slug: string;
          tag: string;
          member_count: number;
          weekly_volume: number;
          total_volume: number;
        }[];
      };
      list_guild_members: {
        Args: { p_guild_id: string; p_limit?: number };
        Returns: {
          user_id: string;
          display_name: string;
          role: string;
          joined_at: string;
        }[];
      };
      follow_trader: {
        Args: {
          p_username: string;
          p_max_stake?: number;
          p_auto_copy?: boolean;
        };
        Returns: string;
      };
      unfollow_trader: {
        Args: { p_leader_id: string };
        Returns: undefined;
      };
      copy_trade: {
        Args: { p_source_trade_id: string; p_stake?: number | null };
        Returns: string;
      };
      get_my_following: {
        Args: Record<string, never>;
        Returns: {
          leader_id: string;
          display_name: string;
          username: string | null;
          max_stake: number;
          auto_copy: boolean;
          follower_count: number;
        }[];
      };
      get_copyable_trades: {
        Args: { p_limit?: number };
        Returns: {
          trade_id: string;
          leader_id: string;
          display_name: string;
          market_id: string;
          market_question: string;
          side: TradeSide;
          stake: number;
          created_at: string;
        }[];
      };
      copy_trader_leaderboard: {
        Args: { p_limit?: number };
        Returns: {
          rank: number;
          user_id: string;
          display_name: string;
          username: string | null;
          follower_count: number;
          copies_received: number;
        }[];
      };
      create_limit_order: {
        Args: {
          p_market_id: string;
          p_side: TradeSide;
          p_limit_price: number;
          p_stake: number;
          p_expires_days?: number;
        };
        Returns: string;
      };
      cancel_limit_order: {
        Args: { p_order_id: string };
        Returns: undefined;
      };
      get_my_limit_orders: {
        Args: { p_limit?: number };
        Returns: {
          id: string;
          market_id: string;
          market_question: string;
          side: TradeSide;
          limit_price: number;
          stake: number;
          status: string;
          created_at: string;
          expires_at: string;
          filled_at: string | null;
        }[];
      };
      admin_sponsor_tournament: {
        Args: {
          p_tournament_id: string;
          p_amount: number;
          p_sponsor_name?: string;
        };
        Returns: number;
      };
      settle_expired_tournaments: {
        Args: { p_limit?: number };
        Returns: number;
      };
      get_tournament_payouts: {
        Args: { p_tournament_id: string };
        Returns: {
          rank: number;
          user_id: string;
          display_name: string;
          amount: number;
          paid_at: string;
        }[];
      };
      get_last_tournament_results: {
        Args: Record<string, never>;
        Returns: Record<string, unknown>;
      };
      platform_activity_tick: {
        Args: { p_limit?: number };
        Returns: number;
      };
      get_next_vote_cost: {
        Args: { p_dispute_id: string };
        Returns: number;
      };
      propose_resolution_community: {
        Args: { p_market_id: string; p_outcome: boolean };
        Returns: undefined;
      };
      grant_battle_pass_xp: {
        Args: { p_amount?: number };
        Returns: Record<string, unknown>;
      };
      claim_battle_pass_tier: {
        Args: { p_tier: number; p_premium?: boolean };
        Returns: number;
      };
      unlock_battle_pass_premium: {
        Args: Record<string, never>;
        Returns: undefined;
      };
      activate_pro_subscription: {
        Args: {
          p_user_id: string;
          p_expires: string;
          p_stripe_customer_id?: string | null;
        };
        Returns: undefined;
      };
      register_platform_bot: {
        Args: { p_bot_user_id: string };
        Returns: undefined;
      };
      resolve_player_code: {
        Args: { p_code: string };
        Returns: {
          user_id: string;
          display_name: string;
          username: string | null;
          referral_code: string;
        }[];
      };
      get_my_player_code: {
        Args: Record<string, never>;
        Returns: {
          referral_code: string;
          username: string | null;
          display_name: string;
        }[];
      };
      create_connect4_game: {
        Args: {
          p_stake: number;
          p_invite_code?: string | null;
          p_friendly?: boolean;
        };
        Returns: string;
      };
      accept_connect4_game: {
        Args: { p_game_id: string };
        Returns: undefined;
      };
      cancel_connect4_game: {
        Args: { p_game_id: string };
        Returns: undefined;
      };
      leave_connect4_game: { Args: { p_game_id: string }; Returns: undefined };
      resign_connect4_game: { Args: { p_game_id: string }; Returns: undefined };
      offer_connect4_draw: { Args: { p_game_id: string }; Returns: undefined };
      accept_connect4_draw: { Args: { p_game_id: string }; Returns: undefined };
      decline_connect4_draw: { Args: { p_game_id: string }; Returns: undefined };
      get_live_connect4_games: {
        Args: { p_limit?: number };
        Returns: {
          id: string;
          creator_name: string;
          opponent_name: string;
          is_friendly: boolean;
          stake: number;
          move_count: number;
          status: string;
          started_at: string | null;
        }[];
      };
      play_connect4_move: {
        Args: { p_game_id: string; p_col: number };
        Returns: {
          winner_id: string | null;
          is_draw: boolean;
          row_played: number;
        }[];
      };
      get_open_connect4_games: {
        Args: { p_limit?: number };
        Returns: {
          id: string;
          creator_id: string;
          creator_name: string;
          stake: number;
          is_friendly: boolean;
          invited_user_id: string | null;
          created_at: string;
        }[];
      };
      get_connect4_game: {
        Args: { p_game_id: string };
        Returns: {
          id: string;
          creator_id: string;
          creator_name: string;
          opponent_id: string | null;
          opponent_name: string;
          invited_user_id: string | null;
          stake: number;
          is_friendly: boolean;
          board: number[];
          current_turn_id: string | null;
          status: string;
          winner_id: string | null;
          settled_at: string | null;
          move_count: number;
          draw_offered_by: string | null;
          started_at: string | null;
          spectator_market_id: string | null;
        }[];
      };
      create_liars_dice_game: {
        Args: {
          p_stake: number;
          p_invite_code?: string | null;
          p_friendly?: boolean;
        };
        Returns: string;
      };
      accept_liars_dice_game: {
        Args: { p_game_id: string };
        Returns: undefined;
      };
      place_liars_dice_bid: {
        Args: { p_game_id: string; p_quantity: number; p_face: number };
        Returns: undefined;
      };
      call_liars_dice: {
        Args: { p_game_id: string };
        Returns: {
          winner_id: string | null;
          actual_count: number;
          bid_quantity: number;
          bid_face: number;
        }[];
      };
      cancel_liars_dice_game: {
        Args: { p_game_id: string };
        Returns: undefined;
      };
      get_open_liars_dice_games: {
        Args: { p_limit?: number };
        Returns: {
          id: string;
          creator_id: string;
          creator_name: string;
          stake: number;
          is_friendly: boolean;
          invited_user_id: string | null;
          created_at: string;
        }[];
      };
      get_liars_dice_game: {
        Args: { p_game_id: string };
        Returns: {
          id: string;
          creator_id: string;
          creator_name: string;
          opponent_id: string | null;
          opponent_name: string;
          invited_user_id: string | null;
          stake: number;
          is_friendly: boolean;
          my_dice: number[] | null;
          creator_dice: number[] | null;
          opponent_dice: number[] | null;
          bid_quantity: number | null;
          bid_face: number | null;
          last_bidder_id: string | null;
          current_turn_id: string | null;
          status: string;
          winner_id: string | null;
          settled_at: string | null;
        }[];
      };
      create_chess_game: {
        Args: {
          p_stake: number;
          p_invite_code?: string | null;
          p_friendly?: boolean;
          p_clock_initial_sec?: number | null;
        };
        Returns: string;
      };
      accept_chess_game: { Args: { p_game_id: string }; Returns: undefined };
      apply_chess_state: {
        Args: {
          p_game_id: string;
          p_fen: string;
          p_next_turn_id: string | null;
          p_status: string;
          p_winner_id: string | null;
          p_result?: string | null;
        };
        Returns: undefined;
      };
      resign_chess_game: { Args: { p_game_id: string }; Returns: undefined };
      cancel_chess_game: { Args: { p_game_id: string }; Returns: undefined };
      leave_chess_game: { Args: { p_game_id: string }; Returns: undefined };
      offer_chess_draw: { Args: { p_game_id: string }; Returns: undefined };
      accept_chess_draw: { Args: { p_game_id: string }; Returns: undefined };
      decline_chess_draw: { Args: { p_game_id: string }; Returns: undefined };
      get_live_chess_games: {
        Args: { p_limit?: number };
        Returns: {
          id: string;
          creator_name: string;
          opponent_name: string;
          is_friendly: boolean;
          stake: number;
          move_count: number;
          status: string;
          started_at: string | null;
        }[];
      };
      get_open_chess_games: {
        Args: { p_limit?: number };
        Returns: {
          id: string;
          creator_id: string;
          creator_name: string;
          stake: number;
          is_friendly: boolean;
          invited_user_id: string | null;
          created_at: string;
        }[];
      };
      get_chess_game: {
        Args: { p_game_id: string };
        Returns: {
          id: string;
          creator_id: string;
          creator_name: string;
          opponent_id: string | null;
          opponent_name: string | null;
          stake: number;
          is_friendly: boolean;
          fen: string;
          current_turn_id: string | null;
          status: string;
          winner_id: string | null;
          result_reason: string | null;
          invited_user_id: string | null;
          move_count: number;
          draw_offered_by: string | null;
          started_at: string | null;
          spectator_market_id: string | null;
          white_ms_left: number | null;
          black_ms_left: number | null;
          clock_initial_sec: number | null;
          clock_increment_sec: number | null;
          clock_running_since: string | null;
        }[];
      };
      create_checkers_game: {
        Args: { p_stake: number; p_invite_code?: string | null; p_friendly?: boolean };
        Returns: string;
      };
      accept_checkers_game: { Args: { p_game_id: string }; Returns: undefined };
      apply_checkers_state: {
        Args: {
          p_game_id: string;
          p_board: number[];
          p_next_turn_id: string | null;
          p_status: string;
          p_winner_id: string | null;
        };
        Returns: undefined;
      };
      cancel_checkers_game: { Args: { p_game_id: string }; Returns: undefined };
      leave_checkers_game: { Args: { p_game_id: string }; Returns: undefined };
      resign_checkers_game: { Args: { p_game_id: string }; Returns: undefined };
      offer_checkers_draw: { Args: { p_game_id: string }; Returns: undefined };
      accept_checkers_draw: { Args: { p_game_id: string }; Returns: undefined };
      decline_checkers_draw: { Args: { p_game_id: string }; Returns: undefined };
      get_live_checkers_games: {
        Args: { p_limit?: number };
        Returns: {
          id: string;
          creator_name: string;
          opponent_name: string;
          is_friendly: boolean;
          stake: number;
          move_count: number;
          status: string;
        }[];
      };
      get_open_checkers_games: {
        Args: { p_limit?: number };
        Returns: {
          id: string;
          creator_id: string;
          creator_name: string;
          stake: number;
          is_friendly: boolean;
          invited_user_id: string | null;
          created_at: string;
        }[];
      };
      get_checkers_game: {
        Args: { p_game_id: string };
        Returns: {
          id: string;
          creator_id: string;
          creator_name: string;
          opponent_id: string | null;
          opponent_name: string | null;
          stake: number;
          is_friendly: boolean;
          board: number[];
          current_turn_id: string | null;
          status: string;
          winner_id: string | null;
          invited_user_id: string | null;
          move_count: number;
          draw_offered_by: string | null;
          started_at: string | null;
          spectator_market_id: string | null;
        }[];
      };
      create_go_game: {
        Args: { p_stake: number; p_invite_code?: string | null; p_friendly?: boolean };
        Returns: string;
      };
      accept_go_game: { Args: { p_game_id: string }; Returns: undefined };
      apply_go_state: {
        Args: {
          p_game_id: string;
          p_board: number[];
          p_prev_board: number[] | null;
          p_pass_count: number;
          p_next_turn_id: string | null;
          p_status: string;
          p_winner_id: string | null;
          p_black_score?: number | null;
          p_white_score?: number | null;
        };
        Returns: undefined;
      };
      resign_go_game: { Args: { p_game_id: string }; Returns: undefined };
      cancel_go_game: { Args: { p_game_id: string }; Returns: undefined };
      leave_go_game: { Args: { p_game_id: string }; Returns: undefined };
      offer_go_draw: { Args: { p_game_id: string }; Returns: undefined };
      accept_go_draw: { Args: { p_game_id: string }; Returns: undefined };
      decline_go_draw: { Args: { p_game_id: string }; Returns: undefined };
      get_live_go_games: {
        Args: { p_limit?: number };
        Returns: {
          id: string;
          creator_name: string;
          opponent_name: string;
          is_friendly: boolean;
          stake: number;
          move_count: number;
          status: string;
        }[];
      };
      get_open_go_games: {
        Args: { p_limit?: number };
        Returns: {
          id: string;
          creator_id: string;
          creator_name: string;
          stake: number;
          is_friendly: boolean;
          invited_user_id: string | null;
          created_at: string;
        }[];
      };
      get_go_game: {
        Args: { p_game_id: string };
        Returns: {
          id: string;
          creator_id: string;
          creator_name: string;
          opponent_id: string | null;
          opponent_name: string | null;
          stake: number;
          is_friendly: boolean;
          board: number[];
          prev_board: number[] | null;
          pass_count: number;
          current_turn_id: string | null;
          status: string;
          winner_id: string | null;
          black_score: number | null;
          white_score: number | null;
          invited_user_id: string | null;
          move_count: number;
          draw_offered_by: string | null;
          started_at: string | null;
          spectator_market_id: string | null;
        }[];
      };
      create_shogi_game: {
        Args: { p_stake: number; p_invite_code?: string | null; p_friendly?: boolean };
        Returns: string;
      };
      accept_shogi_game: { Args: { p_game_id: string }; Returns: undefined };
      apply_shogi_state: {
        Args: {
          p_game_id: string;
          p_sfen: string;
          p_next_turn_id: string | null;
          p_status: string;
          p_winner_id: string | null;
          p_result?: string | null;
        };
        Returns: undefined;
      };
      resign_shogi_game: { Args: { p_game_id: string }; Returns: undefined };
      cancel_shogi_game: { Args: { p_game_id: string }; Returns: undefined };
      leave_shogi_game: { Args: { p_game_id: string }; Returns: undefined };
      offer_shogi_draw: { Args: { p_game_id: string }; Returns: undefined };
      accept_shogi_draw: { Args: { p_game_id: string }; Returns: undefined };
      decline_shogi_draw: { Args: { p_game_id: string }; Returns: undefined };
      get_live_shogi_games: {
        Args: { p_limit?: number };
        Returns: {
          id: string;
          creator_name: string;
          opponent_name: string;
          is_friendly: boolean;
          stake: number;
          move_count: number;
          status: string;
        }[];
      };
      get_open_shogi_games: {
        Args: { p_limit?: number };
        Returns: {
          id: string;
          creator_id: string;
          creator_name: string;
          stake: number;
          is_friendly: boolean;
          invited_user_id: string | null;
          created_at: string;
        }[];
      };
      get_shogi_game: {
        Args: { p_game_id: string };
        Returns: {
          id: string;
          creator_id: string;
          creator_name: string;
          opponent_id: string | null;
          opponent_name: string | null;
          stake: number;
          is_friendly: boolean;
          sfen: string;
          current_turn_id: string | null;
          status: string;
          winner_id: string | null;
          result_reason: string | null;
          invited_user_id: string | null;
          move_count: number;
          draw_offered_by: string | null;
          started_at: string | null;
          spectator_market_id: string | null;
        }[];
      };
      create_poker_game: {
        Args: { p_stake: number; p_invite_code?: string | null; p_friendly?: boolean };
        Returns: string;
      };
      accept_poker_game: {
        Args: { p_game_id: string; p_state: Record<string, unknown> };
        Returns: undefined;
      };
      update_poker_state: {
        Args: { p_game_id: string; p_state: Record<string, unknown> };
        Returns: undefined;
      };
      settle_poker_game: {
        Args: {
          p_game_id: string;
          p_winner_id: string | null;
          p_is_draw: boolean;
          p_state: Record<string, unknown>;
          p_creator_rank: string;
          p_opponent_rank: string;
        };
        Returns: undefined;
      };
      cancel_poker_game: { Args: { p_game_id: string }; Returns: undefined };
      get_open_poker_games: {
        Args: { p_limit?: number };
        Returns: {
          id: string;
          creator_id: string;
          creator_name: string;
          stake: number;
          is_friendly: boolean;
          invited_user_id: string | null;
          created_at: string;
        }[];
      };
      get_poker_game: {
        Args: { p_game_id: string };
        Returns: {
          id: string;
          creator_id: string;
          creator_name: string;
          opponent_id: string | null;
          opponent_name: string | null;
          stake: number;
          is_friendly: boolean;
          state: Record<string, unknown> | null;
          status: string;
          winner_id: string | null;
          creator_hand_rank: string | null;
          opponent_hand_rank: string | null;
          invited_user_id: string | null;
        }[];
      };
      request_gem_withdrawal: {
        Args: { p_gems: number; p_method?: string };
        Returns: string;
      };
      convert_gems_to_vibe: {
        Args: { p_gems: number };
        Returns: {
          gems_spent: number;
          vibe_received: number;
          transaction_id: string;
        }[];
      };
    };
    Enums: {
      currency: Currency;
      account_kind: AccountKind;
      market_status: MarketStatus;
      trade_side: TradeSide;
      item_kind: ItemKind;
    };
  };
}
