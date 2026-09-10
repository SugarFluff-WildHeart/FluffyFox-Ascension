(function () {

  "use strict";


  /* ============================================================
     CONSTANTS
     ============================================================ */

  const ADDON_NAME =
    "FluffyFox Ascension";

  const ADDON_VERSION =
    "0.3.0";

  const DEFAULT_SERVER_NAME =
    "Server";

  const XP_PER_LEVEL =
    100;


  const REWARD_TYPES = [
    "item",
    "blueprint",
    "solari",
    "scrip",
    "xp",
    "intel"
  ];


  const CATEGORY_NAMES = [
    "Level",
    "Story",
    "Side Quests",
    "Faction",
    "Exploration",
    "Achievement"
  ];


  /*
   * Default Battle Pass tiers.
   *
   * These are intentionally simple defaults.
   * The database becomes the source of truth once initialized.
   */

  const DEFAULT_TIERS = [

    {
      tier: 1,
      category: "Level",
      requirement: 5,
      xpRequired: 500,
      title: "First Steps",
      rewardType: "item",
      rewardId: "WaterBottle_1",
      rewardAmount: 1
    },

    {
      tier: 2,
      category: "Level",
      requirement: 10,
      xpRequired: 1000,
      title: "Desert Walker",
      rewardType: "item",
      rewardId: "WaterBottle_1",
      rewardAmount: 2
    },

    {
      tier: 3,
      category: "Level",
      requirement: 15,
      xpRequired: 1500,
      title: "Survivor",
      rewardType: "item",
      rewardId: "WaterBottle_1",
      rewardAmount: 3
    },

    {
      tier: 4,
      category: "Level",
      requirement: 20,
      xpRequired: 2000,
      title: "Spice Hunter",
      rewardType: "item",
      rewardId: "WaterBottle_1",
      rewardAmount: 4
    },

    {
      tier: 5,
      category: "Level",
      requirement: 25,
      xpRequired: 2500,
      title: "Fremen Ally",
      rewardType: "item",
      rewardId: "WaterBottle_1",
      rewardAmount: 5
    },

    {
      tier: 6,
      category: "Level",
      requirement: 30,
      xpRequired: 3000,
      title: "Desert Veteran",
      rewardType: "item",
      rewardId: "WaterBottle_1",
      rewardAmount: 6
    },

    {
      tier: 7,
      category: "Level",
      requirement: 35,
      xpRequired: 3500,
      title: "Spice Adept",
      rewardType: "item",
      rewardId: "WaterBottle_1",
      rewardAmount: 7
    },

    {
      tier: 8,
      category: "Level",
      requirement: 40,
      xpRequired: 4000,
      title: "Arrakis Veteran",
      rewardType: "item",
      rewardId: "WaterBottle_1",
      rewardAmount: 8
    },

    {
      tier: 9,
      category: "Level",
      requirement: 45,
      xpRequired: 4500,
      title: "Sand Master",
      rewardType: "item",
      rewardId: "WaterBottle_1",
      rewardAmount: 9
    },

    {
      tier: 10,
      category: "Level",
      requirement: 50,
      xpRequired: 5000,
      title: "Ascendant",
      rewardType: "item",
      rewardId: "WaterBottle_1",
      rewardAmount: 10
    }

  ];


  const CATEGORIES = [

    {
      name: "Level",
      state: "available",
      description:
        "Reach configured player levels to advance the Battle Pass."
    },

    {
      name: "Story",
      state: "pending",
      description:
        "Main-story progression can unlock configured seasonal rewards."
    },

    {
      name: "Side Quests",
      state: "pending",
      description:
        "Completed side quests can become seasonal progression sources."
    },

    {
      name: "Faction",
      state: "pending",
      description:
        "Faction contracts, quests and ranks can drive progression."
    },

    {
      name: "Exploration",
      state: "pending",
      description:
        "Explored regions and locations can contribute to the season."
    },

    {
      name: "Achievement",
      state: "pending",
      description:
        "Achievement data requires a reliable server-side source."
    }

  ];


  /* ============================================================
     STATE
     ============================================================ */

  const state = {

    players: [],

    season: null,

    tiers: [],

    categoryRules: [],

    eligibleTiers: [],

    editorRewards: [],

    progress: {

      xp: 0,

      delivered: []

    },

    refreshTimer: null,

    loading: false

  };


  /* ============================================================
     DOM
     ============================================================ */

  const $ = (selector) =>
    document.querySelector(selector);


  /* ============================================================
     LOGGING
     ============================================================ */

  function log(message, isError = false) {

    const output =
      $("#log");

    if (!output) {
      return;
    }


    const stamp =
      new Date()
        .toLocaleTimeString();


    output.textContent +=
      `[${stamp}] ${message}\n`;


    output.scrollTop =
      output.scrollHeight;


    if (isError) {

      output.classList.add(
        "error"
      );

    }

  }


  /* ============================================================
     REQUEST HELPER
     ============================================================ */

  async function request(
    action,
    payload = {}
  ) {

    if (
      !window.DuneAddon ||
      typeof window.DuneAddon.request !==
        "function"
    ) {

      throw new Error(
        "Dune addon bridge is unavailable."
      );

    }


    return window.DuneAddon.request(
      action,
      payload
    );

  }


  /* ============================================================
     PLAYER HELPERS
     ============================================================ */

  function playerId(player) {

    return (
      player.id ??
      player.playerId ??
      player.steamId ??
      player.steam_id ??
      player.uuid ??
      player.userId
    );

  }


  function playerName(player) {

    return (
      player.name ??
      player.playerName ??
      player.displayName ??
      player.username ??
      `Player ${playerId(player)}`
    );

  }


  function playerLevel(player) {

    const level =
      Number(
        player.level ??
        player.playerLevel ??
        player.characterLevel ??
        0
      );


    return Number.isFinite(level)
      ? level
      : 0;

  }


  /* ============================================================
     PLAYER LIST
     ============================================================ */

  async function loadPlayers() {

    try {

      const result =
        await request(
          "leadership.players.list"
        );


      const players =
        Array.isArray(result)
          ? result
          : (
              result?.players ||
              result?.items ||
              []
            );


      state.players =
        players;


      renderPlayers();


      log(
        `Loaded ${players.length} player(s).`
      );

    } catch (error) {

      log(
        `Player list failed: ${error.message}`,
        true
      );


      state.players = [

        {
          id: "demo-player",
          name: "Demo Player",
          level: 1
        }

      ];


      renderPlayers();

    }

  }


  function renderPlayers() {

    const select =
      $("#playerSelect");

    if (!select) {
      return;
    }


    const current =
      select.value;


    select.innerHTML = "";


    for (
      const player of state.players
    ) {

      const option =
        document.createElement(
          "option"
        );


      option.value =
        String(
          playerId(player)
        );


      option.textContent =
        playerName(player);


      select.appendChild(
        option
      );

    }


    if (current) {

      const matching =
        [...select.options]
          .find(
            option =>
              option.value === current
          );


      if (matching) {

        select.value =
          current;

      }

    }


    updatePlayerDisplay();

  }


  function getSelectedPlayer() {

    const select =
      $("#playerSelect");

    if (!select) {
      return null;
    }


    const id =
      select.value;


    return (
      state.players.find(
        player =>
          String(
            playerId(player)
          ) === String(id)
      ) ||
      null
    );

  }


  /* ============================================================
     DATABASE
     ============================================================ */

  async function databaseQuery(
    sql,
    params = []
  ) {

    return request(
      "database.query",
      {
        sql,
        params
      }
    );

  }


  async function databaseExecute(
    sql,
    params = []
  ) {

    return request(
      "database.execute",
      {
        sql,
        params
      }
    );

  }


  /* ============================================================
     STORAGE INITIALIZATION
     ============================================================ */

  async function initializeStorage() {

    log(
      "Initializing Battle Pass storage..."
    );


    await databaseExecute(
      `
      create table if not exists dune_battle_pass_seasons (
        id text primary key,
        name text not null,
        server_name text,
        starts_at text,
        ends_at text,
        active integer not null default 1
      )
      `
    );


    await databaseExecute(
      `
      alter table dune_battle_pass_seasons
      add column if not exists server_name text
      `
    ).catch(
      () => {}
    );


    await databaseExecute(
      `
      create table if not exists dune_battle_pass_tiers (
        season_id text not null,
        tier integer not null,
        category text not null,
        requirement integer not null default 0,
        xp_required integer not null default 0,
        title text not null,
        reward_type text not null,
        reward_id text,
        reward_amount integer not null default 1,
        primary key (season_id, tier)
      )
      `
    );


    await databaseExecute(
      `
      create table if not exists dune_battle_pass_progress (
        season_id text not null,
        player_id text not null,
        xp integer not null default 0,
        claimed_tiers text not null default '[]',
        updated_at text,
        primary key (season_id, player_id)
      )
      `
    );


    await databaseExecute(
      `
      create table if not exists dune_battle_pass_xp_events (
        id text primary key,
        season_id text not null,
        player_id text not null,
        amount integer not null,
        source text not null,
        created_at text not null
      )
      `
    );


    await databaseExecute(
      `
      create table if not exists dune_battle_pass_tier_config (
        season_id text not null,
        tier integer not null,
        requirement_key text,
        requirement_operator text not null default '>=',
        primary key (season_id, tier)
      )
      `
    );


    await databaseExecute(
      `
      create table if not exists dune_battle_pass_tier_rewards (
        id text primary key,
        season_id text not null,
        tier integer not null,
        reward_type text not null,
        reward_id text,
        reward_amount integer not null default 1,
        reward_label text,
        created_at text not null
      )
      `
    );


    await databaseExecute(
      `
      create table if not exists dune_battle_pass_category_rules (
        season_id text not null,
        category text not null,
        enabled integer not null default 0,
        label text,
        query_sql text,
        value_column text not null default 'value',
        operator text not null default '>=',
        updated_at text not null,
        primary key (season_id, category)
      )
      `
    );


    await databaseExecute(
      `
      create table if not exists dune_battle_pass_notifications (
        id text primary key,
        season_id text not null,
        player_id text not null,
        message text not null,
        status text not null default 'queued',
        created_at text not null,
        delivered_at text
      )
      `
    );


    await databaseExecute(
      `
      create table if not exists dune_battle_pass_reward_deliveries (
        id text primary key,
        season_id text not null,
        player_id text not null,
        tier integer not null,
        reward_index integer not null,
        status text not null,
        created_at text not null
      )
      `
    );


    const seasonResult =
      await databaseQuery(
        `
        select
          id,
          name,
          server_name,
          starts_at,
          ends_at,
          active
        from dune_battle_pass_seasons
        where active = 1
        order by starts_at desc
        limit 1
        `
      );


    const seasons =
      normalizeRows(
        seasonResult
      );


    if (!seasons.length) {

      const seasonId =
        "arrakis-rising";


      await databaseExecute(
        `
        insert into dune_battle_pass_seasons (
          id,
          name,
          server_name,
          starts_at,
          ends_at,
          active
        )
        values (
          ?,
          ?,
          ?,
          ?,
          ?,
          1
        )
        `,
        [
          seasonId,
          "Arrakis Rising",
          "Server",
          new Date().toISOString(),
          null
        ]
      );


      for (
        const tier of DEFAULT_TIERS
      ) {

        await databaseExecute(
          `
          insert into dune_battle_pass_tiers (
            season_id,
            tier,
            category,
            requirement,
            xp_required,
            title,
            reward_type,
            reward_id,
            reward_amount
          )
          values (
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?
          )
          `,
          [
            seasonId,
            tier.tier,
            tier.category,
            tier.requirement,
            tier.xpRequired,
            tier.title,
            tier.rewardType,
            tier.rewardId,
            tier.rewardAmount
          ]
        );

      }


      log(
        "Created default season: Arrakis Rising."
      );

    }


    await ensureCategoryRules();
    await migrateTierRewards();


    log(
      "Battle Pass storage is ready."
    );

  }


  function normalizeRows(result) {

    if (
      Array.isArray(result)
    ) {

      return result;

    }


    return (
      result?.rows ||
      result?.data ||
      result?.items ||
      []
    );

  }


  /* ============================================================
     SEASON
     ============================================================ */

  async function loadSeason() {

    const result =
      await databaseQuery(
        `
        select
          id,
          name,
          server_name,
          starts_at,
          ends_at,
          active
        from dune_battle_pass_seasons
        where active = 1
        order by starts_at desc
        limit 1
        `
      );


    const rows =
      normalizeRows(result);


    if (!rows.length) {

      throw new Error(
        "No active Battle Pass season exists. Initialize storage first."
      );

    }


    state.season =
      rows[0];


    $("#serverName").textContent =
      state.season.server_name ||
      DEFAULT_SERVER_NAME;


    $("#seasonName").textContent =
      state.season.name ||
      "Arrakis Rising";


    $("#seasonDates").textContent =
      formatSeasonDates(
        state.season
      );


    updateSeasonAutomationStatus();


    setSeasonDateInputs(
      state.season
    );

  }


  function updateSeasonAutomationStatus() {

    const output =
      $("#automationStatus");

    if (!output) {
      return;
    }


    output.textContent =
      isSeasonOpen()
        ? "Automatic rewards enabled"
        : "Season inactive by configured dates";

  }


  function setSeasonDateInputs(
    season
  ) {

    const start =
      $("#seasonStart");

    const end =
      $("#seasonEnd");


    if (start) {

      start.value =
        toDateTimeLocalValue(
          season?.starts_at
        );

    }


    if (end) {

      end.value =
        toDateTimeLocalValue(
          season?.ends_at
        );

    }

  }


  function toDateTimeLocalValue(
    value
  ) {

    if (!value) {
      return "";
    }


    const date =
      new Date(value);


    if (
      Number.isNaN(
        date.getTime()
      )
    ) {

      return "";

    }


    const pad =
      number =>
        String(number)
          .padStart(2, "0");


    return [
      date.getFullYear(),
      pad(date.getMonth() + 1),
      pad(date.getDate())
    ].join("-") +
      "T" +
      [
        pad(date.getHours()),
        pad(date.getMinutes())
      ].join(":");

  }


  async function saveSeasonDates() {

    if (!state.season) {

      log(
        "No active season is loaded.",
        true
      );

      return;

    }


    const startInput =
      $("#seasonStart");

    const endInput =
      $("#seasonEnd");


    const startValue =
      startInput?.value
        ? new Date(
            startInput.value
          ).toISOString()
        : null;


    const endValue =
      endInput?.value
        ? new Date(
            endInput.value
          ).toISOString()
        : null;


    if (
      startValue &&
      endValue &&
      new Date(endValue) <=
        new Date(startValue)
    ) {

      log(
        "Season end must be later than season start.",
        true
      );

      return;

    }


    const button =
      $("#saveSeasonDates");


    if (button) {

      button.disabled =
        true;

    }


    try {

      await databaseExecute(
        `
        update dune_battle_pass_seasons
        set
          starts_at = ?,
          ends_at = ?
        where id = ?
        `,
        [
          startValue,
          endValue,
          state.season.id
        ]
      );


      state.season.starts_at =
        startValue;

      state.season.ends_at =
        endValue;


      $("#seasonDates").textContent =
        formatSeasonDates(
          state.season
        );


      updateSeasonAutomationStatus();


      log(
        "Season start/end dates saved."
      );

    } catch (error) {

      log(
        `Saving season dates failed: ${error.message}`,
        true
      );

    } finally {

      if (button) {

        button.disabled =
          false;

      }

    }

  }


  function formatSeasonDates(
    season
  ) {

    if (
      !season.starts_at &&
      !season.ends_at
    ) {

      return "Season dates managed by server.";

    }


    const start =
      season.starts_at
        ? formatDate(
            season.starts_at
          )
        : "—";


    const end =
      season.ends_at
        ? formatDate(
            season.ends_at
          )
        : "Open-ended";


    return `${start} → ${end}`;

  }


  function formatDate(
    value
  ) {

    const date =
      new Date(value);


    if (
      Number.isNaN(
        date.getTime()
      )
    ) {

      return String(value);

    }


    return date.toLocaleDateString(
      undefined,
      {
        year: "numeric",
        month: "short",
        day: "numeric"
      }
    );

  }


  /* ============================================================
     TIERS
     ============================================================ */

  async function loadTiers() {

    if (!state.season) {
      return;
    }


    const result =
      await databaseQuery(
        `
        select
          tier,
          category,
          requirement,
          xp_required,
          title,
          reward_type,
          reward_id,
          reward_amount
        from dune_battle_pass_tiers
        where season_id = ?
        order by tier asc
        `,
        [
          state.season.id
        ]
      );


    const rows =
      normalizeRows(result);


    state.tiers =
      rows.length
        ? rows.map(
            normalizeTier
          )
        : DEFAULT_TIERS.map(
            tier => ({
              ...tier,
              rewards: [
                normalizeLegacyReward(
                  tier
                )
              ]
            })
          );


    const configRows =
      normalizeRows(
        await databaseQuery(
          `
          select
            tier,
            requirement_key,
            requirement_operator
          from dune_battle_pass_tier_config
          where season_id = ?
          `,
          [
            state.season.id
          ]
        )
      );


    for (
      const tier of state.tiers
    ) {

      const config =
        configRows.find(
          row =>
            Number(row.tier) ===
            Number(tier.tier)
        );


      tier.requirementKey =
        config?.requirement_key ||
        tier.requirementKey ||
        "";


      tier.requirementOperator =
        config?.requirement_operator ||
        tier.requirementOperator ||
        null;

    }


    const rewardResult =
      await databaseQuery(
        `
        select
          id,
          tier,
          reward_type,
          reward_id,
          reward_amount,
          reward_label
        from dune_battle_pass_tier_rewards
        where season_id = ?
        order by tier asc, created_at asc
        `,
        [
          state.season.id
        ]
      );


    const rewardRows =
      normalizeRows(
        rewardResult
      );


    const rewardMap =
      new Map();


    for (
      const row of rewardRows
    ) {

      const key =
        String(
          row.tier
        );


      if (
        !rewardMap.has(key)
      ) {

        rewardMap.set(
          key,
          []
        );

      }


      rewardMap
        .get(key)
        .push(
          normalizeReward(
            row
          )
        );

    }


    for (
      const tier of state.tiers
    ) {

      const rewards =
        rewardMap.get(
          String(tier.tier)
        );


      if (
        rewards?.length
      ) {

        tier.rewards =
          rewards;

      } else {

        tier.rewards =
          [
            normalizeLegacyReward(
              tier
            )
          ];

      }

    }


    renderTiers();

  }


  function normalizeTier(
    row
  ) {

    return {

      tier:
        Number(
          row.tier
        ),

      category:
        row.category ||
        "Level",

      requirement:
        Number(
          row.requirement ||
          0
        ),

      xpRequired:
        Number(
          row.xp_required ||
          0
        ),

      title:
        row.title ||
        `Tier ${row.tier}`,

      rewardType:
        row.reward_type ||
        "item",

      rewardId:
        row.reward_id ||
        null,

      rewardAmount:
        Number(
          row.reward_amount ||
          1
        ),

      requirementKey:
        row.requirement_key ||
        "",

      requirementOperator:
        row.requirement_operator ||
        null,

      rewards: []

    };

  }


  function normalizeLegacyReward(
    tier
  ) {

    return {

      id:
        `legacy:${tier.tier}`,

      rewardType:
        tier.rewardType ||
        "item",

      rewardId:
        tier.rewardId ||
        "",

      rewardAmount:
        Number(
          tier.rewardAmount ||
          1
        ),

      rewardLabel:
        ""

    };

  }


  function normalizeReward(
    row
  ) {

    return {

      id:
        row.id,

      rewardType:
        row.reward_type ||
        "item",

      rewardId:
        row.reward_id ||
        "",

      rewardAmount:
        Number(
          row.reward_amount ||
          1
        ),

      rewardLabel:
        row.reward_label ||
        ""

    };

  }


  async function ensureCategoryRules() {

    if (!state.season) {
      return;
    }


    for (
      const category of CATEGORY_NAMES
    ) {

      const existing =
        normalizeRows(
          await databaseQuery(
            `
            select
              category
            from dune_battle_pass_category_rules
            where season_id = ?
              and category = ?
            limit 1
            `,
            [
              state.season.id,
              category
            ]
          )
        );


      if (
        existing.length
      ) {

        continue;

      }


      await databaseExecute(
        `
        insert into dune_battle_pass_category_rules
          (
            season_id,
            category,
            enabled,
            label,
            query_sql,
            value_column,
            operator,
            updated_at
          )
        values (
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?
        )
        `,
        [
          state.season.id,
          category,
          category === "Level"
            ? 1
            : 0,
          category === "Level"
            ? "Player Level"
            : `${category} source`,
          "",
          "value",
          ">=",
          new Date()
            .toISOString()
        ]
      );

    }

  }


  async function loadCategoryRules() {

    if (!state.season) {
      return;
    }


    const result =
      await databaseQuery(
        `
        select
          category,
          enabled,
          label,
          query_sql,
          value_column,
          operator
        from dune_battle_pass_category_rules
        where season_id = ?
        order by category asc
        `,
        [
          state.season.id
        ]
      );


    const rows =
      normalizeRows(
        result
      );


    state.categoryRules =
      CATEGORY_NAMES.map(
        category => {

          const row =
            rows.find(
              entry =>
                entry.category ===
                category
            );


          return {

            category,

            enabled:
              Number(
                row?.enabled ||
                0
              ) === 1,

            label:
              row?.label ||
              `${category} source`,

            querySql:
              row?.query_sql ||
              "",

            valueColumn:
              row?.value_column ||
              "value",

            operator:
              row?.operator ||
              ">="

          };

        }
      );

  }


  async function migrateTierRewards() {

    if (!state.season) {
      return;
    }


    const tierRows =
      normalizeRows(
        await databaseQuery(
          `
          select
            tier,
            reward_type,
            reward_id,
            reward_amount
          from dune_battle_pass_tiers
          where season_id = ?
          order by tier asc
          `,
          [
            state.season.id
          ]
        )
      );


    for (
      const row of tierRows
    ) {

      const tierNumber =
        Number(
          row.tier
        );


      const existing =
        normalizeRows(
          await databaseQuery(
            `
            select
              id
            from dune_battle_pass_tier_rewards
            where season_id = ?
              and tier = ?
            limit 1
            `,
            [
              state.season.id,
              tierNumber
            ]
          )
        );


      if (
        existing.length
      ) {

        continue;

      }


      const fallback =
        DEFAULT_TIERS.find(
          entry =>
            Number(entry.tier) ===
            tierNumber
        ) ||
        DEFAULT_TIERS[0];


      const rewardType =
        row.reward_type ||
        fallback.rewardType;


      const rewardId =
        row.reward_id ||
        fallback.rewardId;


      const rewardAmount =
        Number(
          row.reward_amount ||
          fallback.rewardAmount ||
          1
        );


      await databaseExecute(
        `
        insert into dune_battle_pass_tier_rewards
          (
            id,
            season_id,
            tier,
            reward_type,
            reward_id,
            reward_amount,
            reward_label,
            created_at
          )
        values (
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?
        )
        `,
        [
          `reward:${state.season.id}:${tierNumber}:legacy`,
          state.season.id,
          tierNumber,
          rewardType,
          rewardId,
          rewardAmount,
          null,
          new Date()
            .toISOString()
        ]
      );

    }

  }


  /* ============================================================
     PROGRESS
     ============================================================ */

  async function loadProgress() {

    const player =
      getSelectedPlayer();


    if (
      !player ||
      !state.season
    ) {

      state.progress = {

        xp: 0,

        delivered: []

      };

      return;

    }


    const result =
      await databaseQuery(
        `
        select
          xp,
          claimed_tiers
        from dune_battle_pass_progress
        where season_id = ?
          and player_id = ?
        limit 1
        `,
        [
          state.season.id,
          String(
            playerId(player)
          )
        ]
      );


    const rows =
      normalizeRows(
        result
      );


    if (
      !rows.length
    ) {

      state.progress = {

        xp: 0,

        delivered: []

      };

      return;

    }


    const row =
      rows[0];


    let delivered =
      [];


    try {

      delivered =
        JSON.parse(
          row.claimed_tiers ||
          "[]"
        );

    } catch {

      delivered =
        [];

    }


    state.progress = {

      xp:
        Number(
          row.xp ||
          0
        ),

      delivered:
        Array.isArray(
          delivered
        )
          ? delivered
          : []

    };

  }


  /* ============================================================
     RENDER TIERS
     ============================================================ */

  function renderTiers() {

    const container =
      $("#tiers");


    if (!container) {
      return;
    }


    container.innerHTML =
      "";


    const xp =
      Number(
        state.progress.xp ||
        0
      );


    let highestUnlocked =
      0;


    for (
      const tier of state.tiers
    ) {

      if (
        xp >=
          tier.xpRequired ||
        state.eligibleTiers.includes(
          Number(tier.tier)
        )
      ) {

        highestUnlocked =
          tier.tier;

      }

    }


    for (
      const tier of state.tiers
    ) {

      const unlocked =
        xp >=
          tier.xpRequired ||
        state.eligibleTiers.includes(
          Number(tier.tier)
        );


      const delivered =
        state.progress.delivered
          .map(String)
          .includes(
            String(tier.tier)
          );


      const current =
        !unlocked &&
        tier.tier ===
          highestUnlocked + 1;


      const article =
        document.createElement(
          "article"
        );


      article.className =
        "tier " +
        (
          unlocked
            ? "unlocked"
            : "locked"
        ) +
        (
          current
            ? " current"
            : ""
        ) +
        (
          delivered
            ? " delivered"
            : ""
        );


      const status =
        delivered
          ? "Reward delivered"
          : unlocked
            ? "Reward ready"
            : `${Math.max(
                0,
                tier.xpRequired -
                  xp
              )} XP remaining`;


      const statusClass =
        delivered
          ? "complete"
          : unlocked
            ? "ready"
            : "";


      article.innerHTML = `

        <div class="tier-number">
          ${escapeHtml(
            tier.tier
          )}
        </div>

        <div>

          <div class="tier-category">
            ${escapeHtml(
              tier.category
            )}
          </div>

          <h3>
            ${escapeHtml(
              tier.title
            )}
          </h3>

        </div>

        <div>

          <div class="tier-reward">
            ${escapeHtml(
              formatReward(
                tier
              )
            )}
          </div>

          <div class="tier-xp">
            ${escapeHtml(
              `${tier.xpRequired} Season XP`
            )}
          </div>

        </div>

        <div class="tier-status ${statusClass}">
          ${escapeHtml(
            status
          )}
        </div>

      `;


      container.appendChild(
        article
      );

    }

  }


  function formatReward(
    tier
  ) {

    const rewards =
      Array.isArray(
        tier.rewards
      ) &&
      tier.rewards.length
        ? tier.rewards
        : [
            normalizeLegacyReward(
              tier
            )
          ];


    return rewards
      .map(
        reward => {

          const type =
            reward.rewardType ||
            "reward";


          const name =
            reward.rewardLabel ||
            reward.rewardId ||
            type;


          return (
            `${name} ×${reward.rewardAmount}`
          );

        }
      )
      .join(
        " · "
      );

  }


  /* ============================================================
     AUTOMATIC REWARD DELIVERY
     ============================================================ */

  async function processRewards() {

    const player =
      getSelectedPlayer();


    if (
      !player ||
      !state.season ||
      !state.tiers.length
    ) {

      return;

    }


    if (
      !isSeasonOpen()
    ) {

      state.eligibleTiers =
        [];

      return;

    }


    const eligible =
      [];


    for (
      const tier of state.tiers
    ) {

      if (
        state.progress.delivered
          .map(String)
          .includes(
            String(tier.tier)
          )
      ) {

        continue;

      }


      let unlocked =
        Number(
          state.progress.xp ||
          0
        ) >=
        Number(
          tier.xpRequired ||
          0
        );


      if (!unlocked) {

        unlocked =
          await isTierRequirementMet(
            player,
            tier
          );

      }


      if (unlocked) {

        eligible.push(
          Number(
            tier.tier
          )
        );

      }

    }


    state.eligibleTiers =
      eligible;


    renderTiers();


    for (
      const tier of state.tiers
    ) {

      if (
        !eligible.includes(
          Number(tier.tier)
        )
      ) {

        continue;

      }


      if (
        state.progress.delivered
          .map(String)
          .includes(
            String(tier.tier)
          )
      ) {

        continue;

      }


      await deliverReward(
        player,
        tier
      );

    }

  }


  function isSeasonOpen() {

    if (!state.season) {
      return false;
    }


    const now =
      Date.now();


    const start =
      state.season.starts_at
        ? new Date(
            state.season.starts_at
          ).getTime()
        : -Infinity;


    const end =
      state.season.ends_at
        ? new Date(
            state.season.ends_at
          ).getTime()
        : Infinity;


    return (
      now >= start &&
      now <= end
    );

  }


  function isReadOnlyQuery(
    query
  ) {

    const normalized =
      String(
        query ||
        ""
      )
        .trim()
        .toLowerCase();


    return (
      normalized.startsWith(
        "select "
      ) &&
      !normalized.includes(
        ";"
      )
    );

  }


  function compareRequirement(
    actual,
    target,
    operator
  ) {

    switch (
      operator
    ) {

      case "=":
        return actual === target;

      case ">":
        return actual > target;

      case "<":
        return actual < target;

      case "<=":
        return actual <= target;

      case "!=":
        return actual !== target;

      case ">=":

      default:
        return actual >= target;

    }

  }


  async function isTierRequirementMet(
    player,
    tier
  ) {

    const category =
      tier.category ||
      "Level";


    const rule =
      state.categoryRules.find(
        entry =>
          entry.category ===
          category
      );


    if (
      !rule?.enabled
    ) {

      return false;

    }


    if (
      category ===
      "Level"
    ) {

      return compareRequirement(
        playerLevel(player),
        Number(
          tier.requirement ||
          0
        ),
        tier.requirementOperator ||
          rule.operator
      );

    }


    if (
      !rule.querySql ||
      !isReadOnlyQuery(
        rule.querySql
      )
    ) {

      return false;

    }


    try {

      const params =
        String(
          rule.querySql
        ).split("?").length - 1 >= 2

          ? [
              String(
                playerId(player)
              ),
              tier.requirementKey ||
                null
            ]

          : [
              String(
                playerId(player)
              )
            ];


      const result =
        await databaseQuery(
          rule.querySql,
          params
        );


      const rows =
        normalizeRows(
          result
        );


      const row =
        rows[0];


      if (!row) {
        return false;
      }


      const rawValue =
        row[
          rule.valueColumn
        ] ??
        row.value ??
        row.progress ??
        row.count;


      const actual =
        Number(
          rawValue
        );


      const target =
        Number(
          tier.requirement ||
          0
        );


      if (
        !Number.isFinite(
          actual
        )
      ) {

        return false;

      }


      return compareRequirement(
        actual,
        target,
        tier.requirementOperator ||
          rule.operator
      );

    } catch (error) {

      log(
        `${category} source check failed for Tier ${tier.tier}: ${error.message}`,
        true
      );


      return false;

    }

  }


  async function queueNotification(
    player,
    message
  ) {

    if (
      !state.season ||
      !player
    ) {

      return;

    }


    const notificationId =
      [
        "notification",
        state.season.id,
        String(
          playerId(player)
        ),
        encodeURIComponent(
          message
        ).slice(
          0,
          180
        )
      ].join(":");


    await databaseExecute(
      `
      insert into dune_battle_pass_notifications
        (
          id,
          season_id,
          player_id,
          message,
          status,
          created_at
        )
      values (
        ?,
        ?,
        ?,
        ?,
        'queued',
        ?
      )
      on conflict (id) do nothing
      `,
      [
        notificationId,
        state.season.id,
        String(
          playerId(player)
        ),
        message,
        new Date()
          .toISOString()
      ]
    );


    log(
      `Player notification queued for ${playerName(player)}. The current addon bridge exposes no private-message action.`
    );

  }


  async function deliverReward(
    player,
    tier
  ) {

    const id =
      String(
        playerId(player)
      );


    const rewards =
      Array.isArray(
        tier.rewards
      ) &&
      tier.rewards.length

        ? tier.rewards

        : [
            normalizeLegacyReward(
              tier
            )
          ];


    const operationId =
      [
        "battle-pass",
        state.season.id,
        id,
        tier.tier
      ].join(":");


    log(
      `Delivering Tier ${tier.tier} reward to ${playerName(player)}...`
    );


    try {

      let allDelivered =
        true;


      for (
        let index = 0;
        index < rewards.length;
        index += 1
      ) {

        const reward =
          rewards[index];


        const rewardOperationId =
          `${operationId}:${index}`;


        const alreadyDelivered =
          normalizeRows(
            await databaseQuery(
              `
              select
                id
              from dune_battle_pass_reward_deliveries
              where id = ?
              limit 1
              `,
              [
                rewardOperationId
              ]
            )
          ).length > 0;


        if (
          alreadyDelivered
        ) {

          continue;

        }


        if (
          reward.rewardType ===
          "item"
        ) {

          await request(
            "admin.items.grant",
            {
              playerId:
                id,

              itemId:
                reward.rewardId,

              amount:
                reward.rewardAmount,

              requestId:
                rewardOperationId
            }
          );


          await databaseExecute(
            `
            insert into dune_battle_pass_reward_deliveries
              (
                id,
                season_id,
                player_id,
                tier,
                reward_index,
                status,
                created_at
              )
            values (
              ?,
              ?,
              ?,
              ?,
              ?,
              'delivered',
              ?
            )
            `,
            [
              rewardOperationId,
              state.season.id,
              id,
              tier.tier,
              index,
              new Date()
                .toISOString()
            ]
          );

        } else if (
          reward.rewardType ===
          "xp"
        ) {

          await addSeasonXp(
            reward.rewardAmount,
            `tier-${tier.tier}-reward`
          );


          await databaseExecute(
            `
            insert into dune_battle_pass_reward_deliveries
              (
                id,
                season_id,
                player_id,
                tier,
                reward_index,
                status,
                created_at
              )
            values (
              ?,
              ?,
              ?,
              ?,
              ?,
              'delivered',
              ?
            )
            `,
            [
              rewardOperationId,
              state.season.id,
              id,
              tier.tier,
              index,
              new Date()
                .toISOString()
            ]
          );

        } else {

          allDelivered =
            false;


          log(
            `Tier ${tier.tier} reward type "${reward.rewardType}" is configured but no corresponding Dune grant API is currently exposed.`
          );

        }

      }


      if (
        !allDelivered
      ) {

        await queueNotification(
          player,
          `Battle Pass Tier ${tier.tier} is unlocked: ${formatReward(tier)}. Some rewards are waiting for a supported Dune grant API.`
        );


        return;

      }


      await markTierDelivered(
        player,
        tier
      );


      state.progress.delivered.push(
        tier.tier
      );


      state.eligibleTiers =
        state.eligibleTiers.filter(
          value =>
            Number(value) !==
            Number(tier.tier)
        );


      await queueNotification(
        player,
        `You earned Battle Pass Tier ${tier.tier}: ${formatReward(tier)}.`
      );


      log(
        `Tier ${tier.tier} delivered to ${playerName(player)}.`
      );


      renderTiers();

    } catch (error) {

      log(
        `Tier ${tier.tier} delivery failed: ${error.message}`,
        true
      );

    }

  }


  async function markTierDelivered(
    player,
    tier
  ) {

    const current =
      [
        ...new Set(
          state.progress.delivered
            .map(Number)
            .concat(
              Number(tier.tier)
            )
        )
      ];


    const now =
      new Date()
        .toISOString();


    await databaseExecute(
      `
      insert into dune_battle_pass_progress (
        season_id,
        player_id,
        xp,
        claimed_tiers,
        updated_at
      )
      values (
        ?,
        ?,
        ?,
        ?,
        ?
      )
      on conflict (
        season_id,
        player_id
      )
      do update set
        xp = excluded.xp,
        claimed_tiers = excluded.claimed_tiers,
        updated_at = excluded.updated_at
      `,
      [
        state.season.id,

        String(
          playerId(player)
        ),

        Number(
          state.progress.xp ||
          0
        ),

        JSON.stringify(
          current
        ),

        now
      ]
    );

  }


  /* ============================================================
     LEVEL SYNC
     ============================================================ */

  async function syncLevelXp() {

    const player =
      getSelectedPlayer();


    if (!player) {

      log(
        "No player selected.",
        true
      );

      return;

    }


    const level =
      playerLevel(player);


    const newXp =
      level *
      XP_PER_LEVEL;


    const currentXp =
      Number(
        state.progress.xp ||
        0
      );


    if (
      newXp <=
      currentXp
    ) {

      log(
        `Level ${level} maps to ${newXp} Season XP. No XP increase required.`
      );


      await processRewards();


      renderAll();


      return;

    }


    const amount =
      newXp -
      currentXp;


    await addSeasonXp(
      amount,
      "level-sync"
    );


    log(
      `Level ${level} synchronized: +${amount} Season XP.`
    );


    await processRewards();


    renderAll();

  }


  /* ============================================================
     XP
     ============================================================ */

  async function addSeasonXp(
    amount,
    source = "admin"
  ) {

    const player =
      getSelectedPlayer();


    if (
      !player ||
      !state.season
    ) {

      throw new Error(
        "A player and active season are required."
      );

    }


    if (
      !isSeasonOpen()
    ) {

      throw new Error(
        "The active season is outside its configured start/end dates."
      );

    }


    const numericAmount =
      Math.trunc(
        Number(
          amount
        )
      );


    if (
      !Number.isFinite(
        numericAmount
      ) ||
      numericAmount === 0
    ) {

      return;

    }


    const playerKey =
      String(
        playerId(player)
      );


    const eventId =
      [
        "xp",
        state.season.id,
        playerKey,
        Date.now(),
        Math.random()
          .toString(16)
          .slice(2)
      ].join(":");


    const currentXp =
      Number(
        state.progress.xp ||
        0
      );


    const newXp =
      Math.max(
        0,
        currentXp +
        numericAmount
      );


    await databaseExecute(
      `
      insert into dune_battle_pass_xp_events (
        id,
        season_id,
        player_id,
        amount,
        source,
        created_at
      )
      values (
        ?,
        ?,
        ?,
        ?,
        ?,
        ?
      )
      `,
      [
        eventId,
        state.season.id,
        playerKey,
        numericAmount,
        source,
        new Date()
          .toISOString()
      ]
    );


    await databaseExecute(
      `
      insert into dune_battle_pass_progress (
        season_id,
        player_id,
        xp,
        claimed_tiers,
        updated_at
      )
      values (
        ?,
        ?,
        ?,
        ?,
        ?
      )
      on conflict (
        season_id,
        player_id
      )
      do update set
        xp = excluded.xp,
        updated_at = excluded.updated_at
      `,
      [
        state.season.id,
        playerKey,
        newXp,
        JSON.stringify(
          state.progress.delivered
        ),
        new Date()
          .toISOString()
      ]
    );


    state.progress.xp =
      newXp;

  }


  async function applyAdminXp() {

    const input =
      $("#xpAdjustment");


    const amount =
      Number(
        input?.value ||
        0
      );


    if (
      !Number.isFinite(
        amount
      ) ||
      amount === 0
    ) {

      log(
        "Enter a non-zero XP adjustment.",
        true
      );

      return;

    }


    try {

      await addSeasonXp(
        amount,
        "admin-adjustment"
      );


      log(
        `Administrator adjustment applied: ${amount > 0 ? "+" : ""}${amount} Season XP.`
      );


      await processRewards();


      renderAll();

    } catch (error) {

      log(
        `XP adjustment failed: ${error.message}`,
        true
      );

    }

  }


  /* ============================================================
     UI
     ============================================================ */

  function updatePlayerDisplay() {

    const player =
      getSelectedPlayer();


    if (!player) {

      $("#playerLevel").textContent =
        "—";

      return;

    }


    $("#playerLevel").textContent =
      String(
        playerLevel(player)
      );

  }


  function renderProgress() {

    const xp =
      Number(
        state.progress.xp ||
        0
      );


    const tiers =
      state.tiers;


    let currentTier =
      0;


    let nextTier =
      null;


    for (
      const tier of tiers
    ) {

      if (
        xp >=
          tier.xpRequired ||
        state.eligibleTiers.includes(
          Number(tier.tier)
        )
      ) {

        currentTier =
          tier.tier;

      } else if (
        !nextTier
      ) {

        nextTier =
          tier;

      }

    }


    const totalTiers =
      tiers.length ||
      1;


    const progressPercent =
      Math.min(
        100,
        Math.round(
          (
            currentTier /
            totalTiers
          ) *
          100
        )
      );


    $("#xpValue").textContent =
      `${xp.toLocaleString()} XP`;


    $("#xpStat").textContent =
      `${xp.toLocaleString()} XP`;


    $("#currentTier").textContent =
      currentTier
        ? `Tier ${currentTier}`
        : "0";


    $("#claimedValue").textContent =
      String(
        state.progress.delivered.length
      );


    $("#xpBar").style.width =
      `${progressPercent}%`;


    $("#seasonProgressPercent").textContent =
      `${progressPercent}%`;


    if (nextTier) {

      const remaining =
        Math.max(
          0,
          nextTier.xpRequired -
          xp
        );


      $("#xpNext").textContent =
        `${remaining.toLocaleString()} XP to Tier ${nextTier.tier}`;

    } else {

      $("#xpNext").textContent =
        "Battle Pass complete";

    }

  }


  function renderCategories() {

    const container =
      $("#categories");


    if (!container) {
      return;
    }


    container.innerHTML =
      "";


    for (
      const category of CATEGORIES
    ) {

      const rule =
        state.categoryRules.find(
          entry =>
            entry.category ===
            category.name
        );


      const available =
        category.name === "Level" ||
        Boolean(
          rule?.enabled &&
          rule?.querySql
        );


      const article =
        document.createElement(
          "article"
        );


      article.className =
        "category";


      article.innerHTML = `

        <div class="category-header">

          <span class="category-name">
            ${escapeHtml(
              category.name
            )}
          </span>

          <span class="category-state ${available ? "available" : "pending"}">
            ${available
              ? "Available"
              : "Configure Source"}
          </span>

        </div>

        <p class="category-description">
          ${escapeHtml(
            rule?.label ||
            category.description
          )}
        </p>

      `;


      container.appendChild(
        article
      );

    }

  }


  function renderAll() {

    updatePlayerDisplay();

    renderProgress();

    renderTiers();

    renderCategories();

    renderAdminEditor();

    renderCategoryEditor();

  }


  function getEditorTier() {

    const select =
      $("#tierEditorSelect");


    if (!select) {
      return null;
    }


    return (
      state.tiers.find(
        tier =>
          String(
            tier.tier
          ) ===
          String(
            select.value
          )
      ) ||
      null
    );

  }


  function renderAdminEditor() {

    const select =
      $("#tierEditorSelect");


    if (!select) {
      return;
    }


    const current =
      select.value;


    select.innerHTML =
      state.tiers
        .map(
          tier =>
            `<option value="${escapeHtml(tier.tier)}">Tier ${escapeHtml(tier.tier)} · ${escapeHtml(tier.title)}</option>`
        )
        .join("");


    if (
      current &&
      state.tiers.some(
        tier =>
          String(
            tier.tier
          ) === current
      )
    ) {

      select.value =
        current;

    }


    const tier =
      getEditorTier() ||
      state.tiers[0];


    if (!tier) {
      return;
    }


    if (!select.value) {

      select.value =
        String(
          tier.tier
        );

    }


    $("#tierTitle").value =
      tier.title ||
      "";


    $("#tierCategory").value =
      tier.category ||
      "Level";


    $("#tierRequirement").value =
      tier.requirement ??
      0;


    $("#tierXpRequired").value =
      tier.xpRequired ??
      0;


    $("#tierRequirementKey").value =
      tier.requirementKey ||
      "";


    state.editorRewards =
      (
        tier.rewards ||
        [
          normalizeLegacyReward(
            tier
          )
        ]
      )
        .map(
          reward => ({
            ...reward
          })
        );


    renderEditorRewards();

  }


  function renderEditorRewards() {

    const container =
      $("#rewardRows");


    if (!container) {
      return;
    }


    container.innerHTML =
      "";


    state.editorRewards
      .forEach(
        (
          reward,
          index
        ) => {

          const row =
            document.createElement(
              "div"
            );


          row.className =
            "reward-editor-row";


          row.innerHTML = `

            <select
              data-reward-field="type"
              data-index="${index}"
              aria-label="Reward type"
            >

              ${REWARD_TYPES
                .map(
                  type =>
                    `<option value="${type}" ${type === reward.rewardType ? "selected" : ""}>${type}</option>`
                )
                .join("")}

            </select>


            <input
              data-reward-field="id"
              data-index="${index}"
              value="${escapeHtml(
                reward.rewardId ||
                ""
              )}"
              placeholder="Item / Blueprint ID"
              aria-label="Reward ID"
            />


            <input
              data-reward-field="amount"
              data-index="${index}"
              type="number"
              min="1"
              step="1"
              value="${Number(
                reward.rewardAmount ||
                1
              )}"
              placeholder="Amount"
              aria-label="Reward amount"
            />


            <input
              data-reward-field="label"
              data-index="${index}"
              value="${escapeHtml(
                reward.rewardLabel ||
                ""
              )}"
              placeholder="Display label (optional)"
              aria-label="Reward label"
            />


            <button
              type="button"
              class="secondary reward-remove"
              data-remove-reward="${index}"
            >
              Remove
            </button>

          `;


          container.appendChild(
            row
          );

        }
      );

  }


  async function saveTierEditor() {

    if (!state.season) {
      return;
    }


    const tier =
      getEditorTier();


    if (!tier) {
      return;
    }


    const title =
      $("#tierTitle")
        ?.value
        .trim() ||
      `Tier ${tier.tier}`;


    const category =
      $("#tierCategory")
        ?.value ||
      "Level";


    const requirement =
      Math.max(
        0,
        Math.trunc(
          Number(
            $("#tierRequirement")
              ?.value ||
            0
          )
        )
      );


    const xpRequired =
      Math.max(
        0,
        Math.trunc(
          Number(
            $("#tierXpRequired")
              ?.value ||
            0
          )
        )
      );


    const requirementKey =
      $("#tierRequirementKey")
        ?.value
        .trim() ||
      "";


    const rewards =
      state.editorRewards
        .map(
          reward => ({
            ...reward,

            rewardAmount:
              Math.max(
                1,
                Math.trunc(
                  Number(
                    reward.rewardAmount ||
                    1
                  )
                )
              )

          })
        )
        .filter(
          reward =>
            reward.rewardType &&
            (
              reward.rewardId ||
              reward.rewardLabel
            )
        );


    if (!rewards.length) {

      log(
        "A tier needs at least one reward entry.",
        true
      );

      return;

    }


    try {

      await databaseExecute(
        `
        update dune_battle_pass_tiers
        set
          category = ?,
          requirement = ?,
          xp_required = ?,
          title = ?,
          reward_type = ?,
          reward_id = ?,
          reward_amount = ?
        where season_id = ?
          and tier = ?
        `,
        [
          category,
          requirement,
          xpRequired,
          title,
          rewards[0].rewardType,
          rewards[0].rewardId ||
            null,
          rewards[0].rewardAmount,
          state.season.id,
          tier.tier
        ]
      );


      await databaseExecute(
        `
        insert into dune_battle_pass_tier_config
          (
            season_id,
            tier,
            requirement_key,
            requirement_operator
          )
        values (
          ?,
          ?,
          ?,
          ?
        )
        on conflict (
          season_id,
          tier
        )
        do update set
          requirement_key =
            excluded.requirement_key,
          requirement_operator =
            excluded.requirement_operator
        `,
        [
          state.season.id,
          tier.tier,
          requirementKey,
          tier.requirementOperator ||
            ">="
        ]
      );


      await databaseExecute(
        `
        delete from dune_battle_pass_tier_rewards
        where season_id = ?
          and tier = ?
        `,
        [
          state.season.id,
          tier.tier
        ]
      );


      for (
        let index = 0;
        index < rewards.length;
        index += 1
      ) {

        const reward =
          rewards[index];


        await databaseExecute(
          `
          insert into dune_battle_pass_tier_rewards
            (
              id,
              season_id,
              tier,
              reward_type,
              reward_id,
              reward_amount,
              reward_label,
              created_at
            )
          values (
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?
          )
          `,
          [
            `reward:${state.season.id}:${tier.tier}:${Date.now()}:${index}`,
            state.season.id,
            tier.tier,
            reward.rewardType,
            reward.rewardId ||
              null,
            reward.rewardAmount,
            reward.rewardLabel ||
              null,
            new Date()
              .toISOString()
          ]
        );

      }


      tier.category =
        category;


      tier.requirement =
        requirement;


      tier.xpRequired =
        xpRequired;


      tier.title =
        title;


      tier.requirementKey =
        requirementKey;


      tier.rewards =
        rewards;


      tier.rewardType =
        rewards[0].rewardType;


      tier.rewardId =
        rewards[0].rewardId;


      tier.rewardAmount =
        rewards[0].rewardAmount;


      log(
        `Tier ${tier.tier} saved with ${rewards.length} reward(s).`
      );


      renderAll();

    } catch (error) {

      log(
        `Saving Tier ${tier.tier} failed: ${error.message}`,
        true
      );

    }

  }


  function renderCategoryEditor() {

    const select =
      $("#categoryEditorSelect");


    if (!select) {
      return;
    }


    const current =
      select.value ||
      "Level";


    select.innerHTML =
      CATEGORY_NAMES
        .map(
          category =>
            `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`
        )
        .join("");


    select.value =
      CATEGORY_NAMES.includes(
        current
      )
        ? current
        : "Level";


    const rule =
      state.categoryRules.find(
        entry =>
          entry.category ===
          select.value
      );


    $("#categoryEnabled").checked =
      Boolean(
        rule?.enabled
      );


    $("#categoryLabel").value =
      rule?.label ||
      "";


    $("#categoryQuery").value =
      rule?.querySql ||
      "";


    $("#categoryValueColumn").value =
      rule?.valueColumn ||
      "value";


    $("#categoryOperator").value =
      rule?.operator ||
      ">=";

  }


  async function saveCategoryRule() {

    if (!state.season) {
      return;
    }


    const category =
      $("#categoryEditorSelect")
        ?.value;


    if (!category) {
      return;
    }


    const enabled =
      $("#categoryEnabled")
        ?.checked
        ? 1
        : 0;


    const label =
      $("#categoryLabel")
        ?.value
        .trim() ||
      `${category} source`;


    const querySql =
      $("#categoryQuery")
        ?.value
        .trim() ||
      "";


    const valueColumn =
      $("#categoryValueColumn")
        ?.value
        .trim() ||
      "value";


    const operator =
      $("#categoryOperator")
        ?.value ||
      ">=";


    if (
      enabled &&
      category !== "Level" &&
      !querySql
    ) {

      log(
        `${category} needs a database query before it can be enabled.`,
        true
      );

      return;

    }


    if (
      querySql &&
      !isReadOnlyQuery(
        querySql
      )
    ) {

      log(
        "Progress source queries must be a single read-only SELECT statement with no semicolon.",
        true
      );

      return;

    }


    try {

      await databaseExecute(
        `
        insert into dune_battle_pass_category_rules
          (
            season_id,
            category,
            enabled,
            label,
            query_sql,
            value_column,
            operator,
            updated_at
          )
        values (
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?
        )
        on conflict (
          season_id,
          category
        )
        do update set
          enabled =
            excluded.enabled,
          label =
            excluded.label,
          query_sql =
            excluded.query_sql,
          value_column =
            excluded.value_column,
          operator =
            excluded.operator,
          updated_at =
            excluded.updated_at
        `,
        [
          state.season.id,
          category,
          enabled,
          label,
          querySql,
          valueColumn,
          operator,
          new Date()
            .toISOString()
        ]
      );


      await loadCategoryRules();


      log(
        `${category} progression source saved.`
      );


      renderAll();

    } catch (error) {

      log(
        `Saving ${category} source failed: ${error.message}`,
        true
      );

    }

  }


  async function testCategoryRule() {

    const category =
      $("#categoryEditorSelect")
        ?.value;


    const rule =
      state.categoryRules.find(
        entry =>
          entry.category ===
          category
      );


    const player =
      getSelectedPlayer();


    if (
      !player ||
      !rule
    ) {

      log(
        "Select a player and category source first.",
        true
      );

      return;

    }


    if (
      category ===
      "Level"
    ) {

      log(
        `Level source test: ${playerLevel(player)}.`
      );

      return;

    }


    const querySql =
      $("#categoryQuery")
        ?.value
        .trim();


    const valueColumn =
      $("#categoryValueColumn")
        ?.value
        .trim() ||
      "value";


    if (!querySql) {

      log(
        "Enter a source query to test.",
        true
      );

      return;

    }


    if (
      !isReadOnlyQuery(
        querySql
      )
    ) {

      log(
        "The source query must be a single read-only SELECT statement with no semicolon.",
        true
      );

      return;

    }


    try {

      const editorTier =
        getEditorTier();


      const params =
        String(
          querySql
        ).split("?").length - 1 >= 2

          ? [
              String(
                playerId(player)
              ),
              editorTier?.requirementKey ||
                null
            ]

          : [
              String(
                playerId(player)
              )
            ];


      const rows =
        normalizeRows(
          await databaseQuery(
            querySql,
            params
          )
        );


      const value =
        rows[0]?.[
          valueColumn
        ] ??
        rows[0]?.value ??
        rows[0]?.progress ??
        rows[0]?.count;


      log(
        `${category} source test for ${playerName(player)}: ${value ?? "no value returned"}.`
      );

    } catch (error) {

      log(
        `${category} source test failed: ${error.message}`,
        true
      );

    }

  }


  /* ============================================================
     REFRESH
     ============================================================ */

  async function refresh() {

    if (
      state.loading
    ) {

      return;

    }


    state.loading =
      true;


    try {

      await loadSeason();


      await ensureCategoryRules();

      await loadCategoryRules();

      await migrateTierRewards();


      await loadTiers();


      await loadProgress();


      renderAll();


      await processRewards();


      renderAll();


      log(
        "Battle Pass refreshed."
      );

    } catch (error) {

      log(
        `Refresh failed: ${error.message}`,
        true
      );

    } finally {

      state.loading =
        false;

    }

  }


  /* ============================================================
     INITIALIZE
     ============================================================ */

  async function initialize() {

    const button =
      $("#initialize");


    if (button) {

      button.disabled =
        true;

    }


    try {

      await initializeStorage();

      await loadPlayers();

      await refresh();

    } catch (error) {

      log(
        `Initialization failed: ${error.message}`,
        true
      );

    } finally {

      if (button) {

        button.disabled =
          false;

      }

    }

  }


  /* ============================================================
     AUTO REFRESH
     ============================================================ */

  function configureAutoRefresh() {

    if (
      state.refreshTimer
    ) {

      window.clearInterval(
        state.refreshTimer
      );


      state.refreshTimer =
        null;

    }


    const select =
      $("#refreshInterval");


    const seconds =
      Number(
        select?.value ||
        0
      );


    if (
      !seconds ||
      seconds < 1
    ) {

      return;

    }


    state.refreshTimer =
      window.setInterval(
        () => {

          refresh();

        },
        seconds * 1000
      );

  }


  /* ============================================================
     INTERFACE SETTINGS
     ============================================================ */

  function applyInterfaceSettings() {

    const root =
      document.documentElement;


    const opacityControl =
      $("#backgroundOpacity");


    const blurControl =
      $("#backgroundBlur");


    const colorPreset =
      $("#colorPreset");


    if (
      !opacityControl ||
      !blurControl ||
      !colorPreset
    ) {

      return;

    }


    const opacity =
      Math.min(
        100,
        Math.max(
          0,
          Number(
            opacityControl.value
          )
        )
      );


    const blur =
      Math.min(
        28,
        Math.max(
          0,
          Number(
            blurControl.value
          )
        )
      );


    root.style.setProperty(
      "--ui-opacity",
      (
        opacity /
        100
      ).toFixed(2)
    );


    root.style.setProperty(
      "--ui-blur",
      `${blur}px`
    );


    root.dataset.textTheme =
      colorPreset.value;


    $("#opacityValue").textContent =
      `${opacity}%`;


    $("#blurValue").textContent =
      `${blur}px`;


    localStorage.setItem(
      "fluffyfox-ui-opacity",
      String(
        opacity
      )
    );


    localStorage.setItem(
      "fluffyfox-ui-blur",
      String(
        blur
      )
    );


    localStorage.setItem(
      "fluffyfox-text-theme",
      colorPreset.value
    );

  }


  function loadInterfaceSettings() {

    const opacity =
      localStorage.getItem(
        "fluffyfox-ui-opacity"
      );


    const blur =
      localStorage.getItem(
        "fluffyfox-ui-blur"
      );


    const theme =
      localStorage.getItem(
        "fluffyfox-text-theme"
      );


    if (
      opacity !== null
    ) {

      $("#backgroundOpacity").value =
        opacity;

    }


    if (
      blur !== null
    ) {

      $("#backgroundBlur").value =
        blur;

    }


    if (
      theme !== null
    ) {

      $("#colorPreset").value =
        theme;

    }


    applyInterfaceSettings();

  }


  /* ============================================================
     EVENTS
     ============================================================ */

  function bindEvents() {

    $("#initialize")
      ?.addEventListener(
        "click",
        initialize
      );


    $("#refresh")
      ?.addEventListener(
        "click",
        refresh
      );


    $("#playerSelect")
      ?.addEventListener(
        "change",
        async () => {

          updatePlayerDisplay();

          await loadProgress();

          renderAll();

          await processRewards();

          renderAll();

        }
      );


    $("#syncLevel")
      ?.addEventListener(
        "click",
        syncLevelXp
      );


    $("#addXp")
      ?.addEventListener(
        "click",
        applyAdminXp
      );


    $("#saveSeasonDates")
      ?.addEventListener(
        "click",
        saveSeasonDates
      );


    $("#tierEditorSelect")
      ?.addEventListener(
        "change",
        renderAdminEditor
      );


    $("#saveTier")
      ?.addEventListener(
        "click",
        saveTierEditor
      );


    $("#addReward")
      ?.addEventListener(
        "click",
        () => {

          state.editorRewards.push(
            {
              id: "",
              rewardType: "item",
              rewardId: "",
              rewardAmount: 1,
              rewardLabel: ""
            }
          );


          renderEditorRewards();

        }
      );


    $("#rewardRows")
      ?.addEventListener(
        "input",
        event => {

          const target =
            event.target;


          const index =
            Number(
              target.dataset.index
            );


          const field =
            target.dataset.rewardField;


          if (
            !Number.isInteger(
              index
            ) ||
            !field ||
            !state.editorRewards[index]
          ) {

            return;

          }


          const key =
            field === "type"
              ? "rewardType"
              : field === "id"
                ? "rewardId"
                : field === "amount"
                  ? "rewardAmount"
                  : "rewardLabel";


          state.editorRewards[index][key] =
            target.value;

        }
      );


    $("#rewardRows")
      ?.addEventListener(
        "click",
        event => {

          const button =
            event.target.closest(
              "[data-remove-reward]"
            );


          if (!button) {
            return;
          }


          state.editorRewards.splice(
            Number(
              button.dataset.removeReward
            ),
            1
          );


          renderEditorRewards();

        }
      );


    $("#categoryEditorSelect")
      ?.addEventListener(
        "change",
        renderCategoryEditor
      );


    $("#saveCategoryRule")
      ?.addEventListener(
        "click",
        saveCategoryRule
      );


    $("#testCategoryRule")
      ?.addEventListener(
        "click",
        testCategoryRule
      );


    $("#backgroundOpacity")
      ?.addEventListener(
        "input",
        applyInterfaceSettings
      );


    $("#backgroundBlur")
      ?.addEventListener(
        "input",
        applyInterfaceSettings
      );


    $("#colorPreset")
      ?.addEventListener(
        "change",
        applyInterfaceSettings
      );


    $("#refreshInterval")
      ?.addEventListener(
        "change",
        configureAutoRefresh
      );

  }


  /* ============================================================
     ESCAPE HTML
     ============================================================ */

  function escapeHtml(
    value
  ) {

    return String(value)
      .replace(
        /&/g,
        "&amp;"
      )
      .replace(
        /</g,
        "&lt;"
      )
      .replace(
        />/g,
        "&gt;"
      )
      .replace(
        /"/g,
        "&quot;"
      )
      .replace(
        /'/g,
        "&#039;"
      );

  }


  /* ============================================================
     STARTUP
     ============================================================ */

  function startup() {

    /*
     * The addon identity is fixed.
     * The server name is deliberately separate.
     */

    document.title =
      ADDON_NAME;


    bindEvents();


    loadInterfaceSettings();


    renderCategories();


    configureAutoRefresh();


    log(
      `${ADDON_NAME} v${ADDON_VERSION} loaded.`
    );


    loadPlayers()
      .then(
        () =>
          refresh()
      )
      .catch(
        error => {

          log(
            `Startup refresh unavailable: ${error.message}`,
            true
          );

        }
      );

  }


  if (
    document.readyState ===
    "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      startup
    );

  } else {

    startup();

  }

})();