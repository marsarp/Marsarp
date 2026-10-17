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

const BOT_TOKEN = process.env.BOT_TOKEN;
const CLIENT_ID = '1560278126242562149';
const GUILD_ID  = '1559798237743808535';

if (!BOT_TOKEN) {
    console.error("❌ BOT_TOKEN introuvable dans les variables d'environnement !");
    process.exit(1);
}

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
let db = { settings: { lang: 'ar' }, warns: {}, applications: {}, alerts: {}, work: {}, workers: {}, waiting: {} };

if (fs.existsSync(DB_FILE)) {
    try {
        db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
        if (!db.work) db.work = {};
        if (!db.workers) db.workers = {};
        if (!db.warns) db.warns = {};
        if (!db.waiting) db.waiting = {};
        if (!db.settings) db.settings = { lang: 'ar' };
    } catch (e) {
        console.log("Réinitialisation de la base de données locale...");
    }
}

function saveDB() {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    } catch (err) {
        console.error("Erreur de sauvegarde DB:", err);
    }
}

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
    console.log(`✅ Bot connecté sous le nom : ${client.user.tag}`);

    const commands = [
        new SlashCommandBuilder().setName('panel').setDescription('Panneau d\'administration principal Marsa RP'),
        new SlashCommandBuilder().setName('staffpanel').setDescription('Panneau du staff pour avertissements et ban (Marsa RP)')
    ].map(cmd => cmd.toJSON());

    const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);
    try {
        await rest.put(
            Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
            { body: commands }
        );
        console.log('🎉 Commandes enregistrées avec succès !');
    } catch (error) {
        console.error('Erreur commandes:', error.message);
    }
});

client.on('interactionCreate', async (interaction) => {
    try {
        if (interaction.isChatInputCommand()) {
            if (interaction.commandName === 'panel') {
                if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                    return interaction.reply({ content: '❌ Réservé aux administrateurs !', ephemeral: true });
                }

                const embed = new EmbedBuilder()
                    .setTitle('📌 Panneau d\'administration Marsa RP')
                    .setDescription('Sélectionnez une option ci-dessous pour gérer le serveur :')
                    .setColor(0x00AE86);

                const menu = new StringSelectMenuBuilder()
                    .setCustomId('bot_control_menu')
                    .setPlaceholder('... Choisir une option de contrôle')
                    .addOptions([
                        { label: 'Configuration Salon Service', description: 'Configurer le système de prise de service', value: 'option_setup_work', emoji: '💼' },
                        { label: 'Configuration Salon Waiting', description: 'Définir le salon de notifications d\'attente', value: 'option_setup_waiting', emoji: '⏳' },
                        { label: 'Leaderboard Service', description: 'Afficher les membres les plus actifs', value: 'option_top_workers', emoji: '🏆' },
                        { label: 'Changer le nom du bot', description: 'Modifier le pseudo du bot', value: 'option_change_name', emoji: '✏️' },
                        { label: 'Changer l\'avatar du bot', description: 'Modifier la photo de profil du bot', value: 'option_change_avatar', emoji: '🖼️' }
                    ]);

                const rowMenu = new ActionRowBuilder().addComponents(menu);
                const rowButtons = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('open_app_selection').setLabel('📝 Candidatures (Applications)').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('setup_lang').setLabel('🌐 Changer la langue').setStyle(ButtonStyle.Secondary)
                );

                return await interaction.reply({ embeds: [embed], components: [rowMenu, rowButtons], ephemeral: true });
            }

            if (interaction.commandName === 'staffpanel') {
                if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
                    return interaction.reply({ content: '❌ Réservé au Staff !', ephemeral: true });
                }

                const embed = new EmbedBuilder()
                    .setTitle('🛡️ Panneau Staff - Marsa RP')
                    .setDescription('Gestion des sanctions et des avertissements :')
                    .setColor(0xFF0000);

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('open_warn_system').setLabel('⚠️ Appliquer une Sanction / Ban').setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId('send_waiting_notif').setLabel('⏳ Envoyer Notification Waiting').setStyle(ButtonStyle.Warning),
                    new ButtonBuilder().setCustomId('check_player_history').setLabel('🔍 Historique du Joueur').setStyle(ButtonStyle.Primary)
                );

                return await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
            }
        }

        // --- CHOIX DES APPLICATIONS (Dev App vs Staff App) ---
        if (interaction.isButton() && interaction.customId === 'open_app_selection') {
            const embed = new EmbedBuilder()
                .setTitle('📋 Choisir le type de candidature')
                .setDescription('Veuillez sélectionner le type de candidature que vous souhaitez ouvrir dans le menu ci-dessous :')
                .setColor(0x3498DB);

            const selectApp = new StringSelectMenuBuilder()
                .setCustomId('select_application_type')
                .setPlaceholder('... Choisissez une candidature')
                .addOptions([
                    { label: 'Candidature Développeur (Dev App)', description: 'Postuler pour rejoindre l\'équipe de développement', value: 'app_dev', emoji: '💻' },
                    { label: 'Candidature Staff / RP', description: 'Postuler pour intégrer l\'équipe d\'animation ou modération', value: 'app_staff', emoji: '🛡️' }
                ]);

            const row = new ActionRowBuilder().addComponents(selectApp);
            return await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
        }

        if (interaction.isStringSelectMenu() && interaction.customId === 'select_application_type') {
            const chosen = interaction.values[0];

            if (chosen === 'app_dev') {
                const modal = new ModalBuilder().setCustomId('modal_submit_dev_app').setTitle('Candidature Développeur (Dev App)');
                const exp = new TextInputBuilder().setCustomId('dev_exp').setLabel('Vos compétences (Lua, JS, HTML...)').setStyle(TextInputStyle.Paragraph).setRequired(true);
                const projects = new TextInputBuilder().setCustomId('dev_projects').setLabel('Vos anciens projets').setStyle(TextInputStyle.Paragraph).setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(exp), new ActionRowBuilder().addComponents(projects));
                return await interaction.showModal(modal);
            }

            if (chosen === 'app_staff') {
                const modal = new ModalBuilder().setCustomId('modal_submit_staff_app').setTitle('Candidature Staff / RP');
                const age = new TextInputBuilder().setCustomId('staff_age').setLabel('Votre âge').setStyle(TextInputStyle.Short).setRequired(true);
                const exp = new TextInputBuilder().setCustomId('staff_exp').setLabel('Expérience Roleplay / Modération').setStyle(TextInputStyle.Paragraph).setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(age), new ActionRowBuilder().addComponents(exp));
                return await interaction.showModal(modal);
            }
        }

        // --- MENU SELECTION ADMIN / STAFF ---
        if (interaction.isStringSelectMenu() && interaction.customId === 'bot_control_menu') {
            const selected = interaction.values[0];

            if (selected === 'option_setup_waiting') {
                const modal = new ModalBuilder().setCustomId('modal_setup_waiting_chan').setTitle('Configuration Salon Waiting');
                const input = new TextInputBuilder().setCustomId('waiting_chan_id').setLabel('ID du salon Waiting / Notification').setStyle(TextInputStyle.Short).setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(input));
                return await interaction.showModal(modal);
            }

            if (selected === 'option_setup_work') {
                const modal = new ModalBuilder().setCustomId('modal_setup_work').setTitle('Configuration Prise de Service');
                const input = new TextInputBuilder().setCustomId('work_chan_id').setLabel('ID du salon Prise de Service').setStyle(TextInputStyle.Short).setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(input));
                return await interaction.showModal(modal);
            }
        }

        // --- BOUTONS DU STAFF PANEL ---
        if (interaction.isButton()) {
            if (interaction.customId === 'send_waiting_notif') {
                const modal = new ModalBuilder().setCustomId('modal_send_waiting_user').setTitle('Notification d\'Attente (Waiting)');
                const userId = new TextInputBuilder().setCustomId('waiting_user_id').setLabel('ID du membre').setStyle(TextInputStyle.Short).setRequired(true);
                const reason = new TextInputBuilder().setCustomId('waiting_reason').setLabel('Raison / Motif de l\'attente').setStyle(TextInputStyle.Paragraph).setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(userId), new ActionRowBuilder().addComponents(reason));
                return await interaction.showModal(modal);
            }

            if (interaction.customId === 'open_warn_system') {
                const modal = new ModalBuilder().setCustomId('modal_apply_warn').setTitle('Système de Sanctions & Bans');
                const userInput = new TextInputBuilder().setCustomId('target_user_id').setLabel('ID de l\'utilisateur').setStyle(TextInputStyle.Short).setRequired(true);
                const ruleInput = new TextInputBuilder().setCustomId('rule_violation').setLabel('Infraction (ex: RDM, VDM, COMBAT LOGGING)').setStyle(TextInputStyle.Short).setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(userInput), new ActionRowBuilder().addComponents(ruleInput));
                return await interaction.showModal(modal);
            }
        }

        // --- SOUMISSION DE FORMULAIRES (MODALS) ---
        if (interaction.isModalSubmit()) {
            await interaction.deferReply({ ephemeral: true });

            if (interaction.customId === 'modal_setup_waiting_chan') {
                const chanId = interaction.fields.getTextInputValue('waiting_chan_id');
                db.settings.waitingChannel = chanId;
                saveDB();
                return await interaction.editReply({ content: `✅ Salon d'attente configuré avec succès ! (ID : ${chanId})` });
            }

            if (interaction.customId === 'modal_send_waiting_user') {
                const userId = interaction.fields.getTextInputValue('waiting_user_id');
                const reason = interaction.fields.getTextInputValue('waiting_reason');

                const targetUser = await client.users.fetch(userId).catch(() => null);
                if (!targetUser) return await interaction.editReply({ content: '❌ Utilisateur introuvable.' });

                const waitingEmbed = new EmbedBuilder()
                    .setTitle('⏳ Notification d\'Attente (Waiting Room)')
                    .setDescription(`Bonjour <@${userId}>,\n\nVous êtes attendu dans le salon d'attente / support pour la raison suivante :\n🔹 **Raison :** ${reason}`)
                    .setColor(0xF1C40F)
                    .setTimestamp();

                // Notification en message privé (MP)
                await targetUser.send({ embeds: [waitingEmbed] }).catch(() => {});

                // Notification dans le salon configuré
                if (db.settings.waitingChannel) {
                    const channel = await client.channels.fetch(db.settings.waitingChannel).catch(() => null);
                    if (channel) {
                        await channel.send({ content: `<@${userId}>`, embeds: [waitingEmbed] });
                    }
                }

                return await interaction.editReply({ content: `✅ Notification d'attente envoyée avec succès à <@${userId}> !` });
            }

            if (interaction.customId === 'modal_apply_warn') {
                const userId = interaction.fields.getTextInputValue('target_user_id');
                const rule = interaction.fields.getTextInputValue('rule_violation').toUpperCase().trim();

                if (!db.warns[userId]) db.warns[userId] = {};
                if (!db.warns[userId][rule]) db.warns[userId][rule] = 0;

                db.warns[userId][rule] += 1;
                const count = db.warns[userId][rule];
                saveDB();

                let penaltyText = "Avertissement / Action administrative";
                if (penaltiesTable[rule]) {
                    const offenseLevel = count > 3 ? 3 : count;
                    penaltyText = penaltiesTable[rule][offenseLevel];
                }

                const banEmbed = new EmbedBuilder()
                    .setTitle('🚨 Notification de Sanction / Ban')
                    .setDescription(`Une sanction a été appliquée au membre <@${userId}> :\n\n📌 **Règle enfreinte :** ${rule}\n🔄 **Récidive :** N°${count}\n⚖️ **Sanction :** **${penaltyText}**`)
                    .setColor(0xE74C3C)
                    .setTimestamp();

                // Envoi en MP au membre sanctionné
                const targetUser = await client.users.fetch(userId).catch(() => null);
                if (targetUser) {
                    await targetUser.send({ embeds: [banEmbed] }).catch(() => {});
                }

                return await interaction.editReply({ embeds: [banEmbed], content: '✅ Sanction enregistrée et notification envoyée !' });
            }

            if (interaction.customId === 'modal_submit_dev_app') {
                const exp = interaction.fields.getTextInputValue('dev_exp');
                const projects = interaction.fields.getTextInputValue('dev_projects');

                return await interaction.editReply({ content: `✅ Votre candidature **Développeur (Dev App)** a bien été reçue !\n\n**Compétences :** ${exp}\n**Projets :** ${projects}` });
            }

            if (interaction.customId === 'modal_submit_staff_app') {
                const age = interaction.fields.getTextInputValue('staff_age');
                const exp = interaction.fields.getTextInputValue('staff_exp');

                return await interaction.editReply({ content: `✅ Votre candidature **Staff / RP** a bien été reçue !\n\n**Âge :** ${age}\n**Expérience :** ${exp}` });
            }
        }
    } catch (err) {
        console.error("Erreur interaction :", err);
    }
});

process.on('unhandledRejection', error => {
    console.error('Erreur non gérée :', error);
});

client.login(BOT_TOKEN);
