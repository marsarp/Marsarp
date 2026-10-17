const { 
    Client, 
    GatewayIntentBits, 
    Partials, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    PermissionFlagsBits,
    REST,
    Routes,
    SlashCommandBuilder,
    StringSelectMenuBuilder
} = require('discord.js');
const fs = require('fs');

// ==================== [ Data Configuration ] ====================
require('dotenv').config();
const BOT_TOKEN = process.env.BOT_TOKEN;
const CLIENT_ID = '1560278126242562149';
const GUILD_ID  = '1559798237743808535';

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildVoiceStates
    ],
    partials: [Partials.Channel, Partials.Message, Partials.User]
});

const DB_FILE = './database.json';
let db = { settings: { lang: 'ar' }, warns: {}, applications: {}, alerts: {}, work: {}, workers: {} };

if (fs.existsSync(DB_FILE)) {
    try {
        db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
        if (!db.work) db.work = {};
        if (!db.workers) db.workers = {};
        if (!db.warns) db.warns = {};
        if (!db.settings) db.settings = { lang: 'ar' };
    } catch (e) {
        console.log("Re-initializing local database...");
    }
}

function saveDB() {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// Penalties Table from your rules image
const penaltiesTable = {
    "META GAMING": { 1: "Warning", 2: "1hr kick/mute", 3: "1-day ban" },
    "POWER GAMING": { 1: "Verbal warning", 2: "30min kick", 3: "1-day ban" },
    "MASS RP": { 1: "Warning + scene reset", 2: "1-day ban", 3: "3-day ban" },
    "FULL RP": { 1: "Warning", 2: "1-day ban", 3: "3-day ban" },
    "COP BAITING": { 1: "Warning", 2: "1-day ban", 3: "3-day ban" },
    "VEHICLE THEFT": { 1: "Warning + vehicle returned", 2: "1-day ban", 3: "3-day ban" },
    "RDM": { 1: "1-day ban", 2: "3-day ban", 3: "7-day ban" },
    "VDM": { 1: "1-day ban", 2: "3-day ban", 3: "7-day ban" },
    "REVENGE KILL": { 1: "1-day ban", 2: "3-day ban", 3: "7-day ban" },
    "POWER KILL": { 1: "1-day ban", 2: "3-day ban", 3: "7-day ban" },
    "EMS SANCTITY VIOLATION": { 1: "2-day ban", 2: "5-day ban", 3: "Permanent ban" },
    "COMBAT STORING": { 1: "Warning + item returned/destroyed", 2: "1-day ban", 3: "3-day ban" },
    "FAIL DRIVE": { 1: "Warning", 2: "30min kick", 3: "1-day ban" },
    "COMBAT LOGGING": { 1: "3-day ban", 2: "7-day ban", 3: "Permanent ban" }
};

client.once('ready', async () => {
    console.log(`✅ Bot ready & logged in as: ${client.user.tag}`);

    const commands = [
        new SlashCommandBuilder().setName('panel').setDescription('Main Admin Panel (Marsa RP)'),
        new SlashCommandBuilder().setName('staffpanel').setDescription('Staff Team Penalties Panel (Ban/Warn)')
    ].map(cmd => cmd.toJSON());

    const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);
    try {
        console.log('Registering Slash Commands...');
        await rest.put(
            Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
            { body: commands }
        );
        console.log('🎉 Commands registered successfully!');
    } catch (error) {
        console.error('❌ Registration error:', error);
    }
});

client.on('guildMemberAdd', async (member) => {
    try {
        const defaultNick = `Marsa | ${member.user.username}`;
        await member.setNickname(defaultNick).catch(() => {});
    } catch (e) {
        console.log("Cannot change nickname automatically.");
    }
});

client.on('interactionCreate', async (interaction) => {
    try {
        if (interaction.isChatInputCommand() && interaction.commandName === 'panel') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ Reserved for Admins only!', ephemeral: true });
            }

            const embed = new EmbedBuilder()
                .setTitle('📌 Marsa RP Admin Panel')
                .setDescription(`Select an option below:\n🌐 **Language:** ${db.settings.lang === 'ar' ? 'العربية 🇸🇦' : 'English 🇬🇧'}`)
                .setColor(0x00AE86);

            const menu = new StringSelectMenuBuilder()
                .setCustomId('bot_control_menu')
                .setPlaceholder('... Select control option')
                .addOptions([
                    { label: 'Work Channel Setup', description: 'Setup work buttons in a channel', value: 'option_setup_work', emoji: '💼' },
                    { label: 'Top Workers Leaderboard', description: 'Show active workers', value: 'option_top_workers', emoji: '🏆' },
                    { label: 'Active Voice 24/7', description: 'Keep bot in voice channel', value: 'option_voice_247', emoji: '🔊' },
                    { label: 'Interview Notif Channel', description: 'Set interview alert channel', value: 'option_interview_chan', emoji: '🎙️' },
                    { label: 'General Broadcast', description: 'Send broadcast message', value: 'option_broadcast', emoji: '📢' },
                    { label: 'Change Bot Name', description: 'Modify bot name', value: 'option_change_name', emoji: '✏️' },
                    { label: 'Change Bot Avatar', description: 'Modify bot avatar', value: 'option_change_avatar', emoji: '🖼️' }
                ]);

            const rowMenu = new ActionRowBuilder().addComponents(menu);
            const rowButtons = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('setup_app').setLabel('📝 Setup Application').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('setup_lang').setLabel('🌐 Change Language').setStyle(ButtonStyle.Secondary)
            );

            return await interaction.reply({ embeds: [embed], components: [rowMenu, rowButtons], ephemeral: true });
        }

        if (interaction.isChatInputCommand() && interaction.commandName === 'staffpanel') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
                return interaction.reply({ content: '❌ Reserved for Staff Team only!', ephemeral: true });
            }

            const embed = new EmbedBuilder()
                .setTitle('🛡️ Staff Panel (Marsa RP)')
                .setDescription('Manage user penalties according to server rules:')
                .setColor(0xFF0000);

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('open_warn_system').setLabel('⚠️ Give Penalty (Warn/Ban)').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('check_player_history').setLabel('🔍 Check Player History').setStyle(ButtonStyle.Primary)
            );

            return await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
        }

        if (interaction.isStringSelectMenu() && interaction.customId === 'bot_control_menu') {
            const selected = interaction.values[0];

            if (selected === 'option_setup_work') {
                const modal = new ModalBuilder().setCustomId('modal_setup_work').setTitle('Work Setup');
                const chanInput = new TextInputBuilder().setCustomId('work_chan_id').setLabel('Work Channel ID').setStyle(TextInputStyle.Short).setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(chanInput));
                return await interaction.showModal(modal);
            }

            if (selected === 'option_top_workers') {
                const sortedWorkers = Object.entries(db.workers || {})
                    .sort((a, b) => b[1].score - a[1].score)
                    .slice(0, 10);

                let desc = '🏆 **Top Active Workers (Top 10):**\n\n';
                if (sortedWorkers.length === 0) {
                    desc += 'No work data registered yet.';
                } else {
                    sortedWorkers.forEach(([userId, data], index) => {
                        desc += `**#${index + 1}** - <@${userId}> ➔ Duty count: **${data.score}**\n`;
                    });
                }

                const embed = new EmbedBuilder().setTitle('📊 Leaderboard').setDescription(desc).setColor(0xFFD700);
                return await interaction.reply({ embeds: [embed], ephemeral: true });
            }

            if (selected === 'option_change_name') {
                const modal = new ModalBuilder().setCustomId('modal_change_name').setTitle('Change Bot Name');
                const nameInput = new TextInputBuilder().setCustomId('new_bot_name').setLabel('New Name').setStyle(TextInputStyle.Short).setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(nameInput));
                return await interaction.showModal(modal);
            }

            if (selected === 'option_change_avatar') {
                const modal = new ModalBuilder().setCustomId('modal_change_avatar').setTitle('Change Avatar');
                const avatarInput = new TextInputBuilder().setCustomId('new_bot_avatar').setLabel('Avatar Image URL').setStyle(TextInputStyle.Short).setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(avatarInput));
                return await interaction.showModal(modal);
            }

            if (selected === 'option_broadcast') {
                const modal = new ModalBuilder().setCustomId('modal_broadcast').setTitle('Broadcast Message');
                const chanInput = new TextInputBuilder().setCustomId('broadcast_chan').setLabel('Channel ID').setStyle(TextInputStyle.Short).setRequired(true);
                const msgInput = new TextInputBuilder().setCustomId('broadcast_msg').setLabel('Message Content').setStyle(TextInputStyle.Paragraph).setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(chanInput), new ActionRowBuilder().addComponents(msgInput));
                return await interaction.showModal(modal);
            }

            if (selected === 'option_interview_chan') {
                const modal = new ModalBuilder().setCustomId('modal_interview_chan').setTitle('Interview Channel');
                const chanInput = new TextInputBuilder().setCustomId('interview_chan_id').setLabel('Interview Channel ID').setStyle(TextInputStyle.Short).setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(chanInput));
                return await interaction.showModal(modal);
            }
        }

        if (interaction.isButton()) {
            if (interaction.customId === 'start_work_btn') {
                const userId = interaction.user.id;
                if (!db.workers[userId]) db.workers[userId] = { score: 0 };
                db.workers[userId].score += 1;
                saveDB();
                return await interaction.reply({ content: `✅ Duty started! Total duty sessions: **${db.workers[userId].score}**`, ephemeral: true });
            }

            if (interaction.customId === 'stop_work_btn') {
                return await interaction.reply({ content: '🛑 Duty stopped / break recorded.', ephemeral: true });
            }

            if (interaction.customId === 'setup_app') {
                const modal = new ModalBuilder().setCustomId('modal_setup_app').setTitle('Application Setup');
                const chanInput = new TextInputBuilder().setCustomId('app_chan_id').setLabel('Channel ID').setStyle(TextInputStyle.Short).setRequired(true);
                const countInput = new TextInputBuilder().setCustomId('app_count').setLabel('Questions count').setStyle(TextInputStyle.Short).setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(chanInput), new ActionRowBuilder().addComponents(countInput));
                return await interaction.showModal(modal);
            }

            if (interaction.customId === 'start_application') {
                await interaction.reply({ content: 'Check your DM to start application!', ephemeral: true });
                try {
                    const dmChannel = await interaction.user.createDM();
                    await dmChannel.send('Welcome to Marsa RP Application. Question 1: What is your previous RP experience?');
                } catch (e) {
                    await interaction.followUp({ content: '❌ Cannot send DM, please enable Direct Messages.', ephemeral: true });
                }
            }

            if (interaction.customId === 'open_warn_system') {
                const modal = new ModalBuilder().setCustomId('modal_apply_warn').setTitle('Penalties System');
                const userInput = new TextInputBuilder().setCustomId('target_user_id').setLabel('User ID').setStyle(TextInputStyle.Short).setRequired(true);
                const ruleInput = new TextInputBuilder().setCustomId('rule_violation').setLabel('Rule Violation (e.g. RDM, VDM, META GAMING)').setStyle(TextInputStyle.Short).setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(userInput), new ActionRowBuilder().addComponents(ruleInput));
                return await interaction.showModal(modal);
            }

            if (interaction.customId === 'check_player_history') {
                const modal = new ModalBuilder().setCustomId('modal_check_history').setTitle('Player History');
                const userInput = new TextInputBuilder().setCustomId('history_user_id').setLabel('User ID').setStyle(TextInputStyle.Short).setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(userInput));
                return await interaction.showModal(modal);
            }
        }

        if (interaction.isModalSubmit()) {
            if (interaction.customId === 'modal_setup_work') {
                const chanId = interaction.fields.getTextInputValue('work_chan_id');
                const channel = await client.channels.fetch(chanId).catch(() => null);
                if (!channel) return await interaction.reply({ content: '❌ Invalid Channel ID!', ephemeral: true });

                const embed = new EmbedBuilder()
                    .setTitle('💼 Work & Duty System - Marsa RP')
                    .setDescription('Click **🟢 Start Duty** to log your work, or **🔴 Stop Duty** for break/finish:')
                    .setColor(0x3498DB);

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('start_work_btn').setLabel('🟢 Start Duty').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('stop_work_btn').setLabel('🔴 Stop Duty').setStyle(ButtonStyle.Danger)
                );

                await channel.send({ embeds: [embed], components: [row] });
                return await interaction.reply({ content: '✅ Work buttons posted successfully!', ephemeral: true });
            }

            if (interaction.customId === 'modal_apply_warn') {
                const userId = interaction.fields.getTextInputValue('target_user_id');
                const rule = interaction.fields.getTextInputValue('rule_violation').toUpperCase().trim();

                if (!db.warns[userId]) db.warns[userId] = {};
                if (!db.warns[userId][rule]) db.warns[userId][rule] = 0;

                db.warns[userId][rule] += 1;
                const count = db.warns[userId][rule];
                saveDB();

                let penaltyText = "General warning / action";
                if (penaltiesTable[rule]) {
                    const offenseLevel = count > 3 ? 3 : count;
                    penaltyText = penaltiesTable[rule][offenseLevel];
                }

                return await interaction.reply({
                    content: `✅ Violation logged for <@${userId}>.\n📌 **Violation:** ${rule}\n🔄 **Offense Count:** #${count}\n⚖️ **Applied Penalty:** **${penaltyText}**`,
                    ephemeral: true
                });
            }

            if (interaction.customId === 'modal_check_history') {
                const userId = interaction.fields.getTextInputValue('history_user_id');
                const userWarns = db.warns[userId];

                if (!userWarns || Object.keys(userWarns).length === 0) {
                    return await interaction.reply({ content: `✅ Player <@${userId}> has a clean record.`, ephemeral: true });
                }

                let report = `📋 **Violation History for <@${userId}>:**\n`;
                for (const [rule, count] of Object.entries(userWarns)) {
                    report += `- **${rule}**: Offense count: ${count}\n`;
                }

                return await interaction.reply({ content: report, ephemeral: true });
            }
        }
    } catch (err) {
        console.error("Execution error:", err);
    }
});

client.login(BOT_TOKEN);
