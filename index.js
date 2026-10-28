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
const { joinVoiceChannel } = require('@discordjs/voice');
const fs = require('fs');

const BOT_TOKEN = process.env.BOT_TOKEN;
const CLIENT_ID = '1560278126242562149';
const GUILD_ID  = '1536367054586642512';

// 👑 Super Admin ID الخاص بك
const SUPER_ADMIN_ID = '1525233760058998884';

if (!BOT_TOKEN) {
    console.error("❌ BOT_TOKEN غير موجود في متغيرات البيئة!");
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
let db = { 
    settings: { 
        apps: {}, 
        voice247: '', 
        prefixTag: 'mars/', 
        serverTag: '',
        workChannel: '',
        warnChannel: '',
        banChannel: '',
        logChannel: '',
        wInterview: {}, 
        wHelp: {} 
    }, 
    warns: {}, 
    work: {},
    activeWork: {},
    userSessions: {} 
};

if (fs.existsSync(DB_FILE)) {
    try {
        db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
        if (!db.settings) db.settings = {};
        if (!db.settings.apps) db.settings.apps = {};
        if (!db.work) db.work = {};
        if (!db.activeWork) db.activeWork = {};
        if (!db.userSessions) db.userSessions = {};
    } catch (e) {
        console.log("إعادة تهيئة قاعدة البيانات المحلية...");
    }
}

function saveDB() {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    } catch (err) {
        console.error("خطأ أثناء حفظ قاعدة البيانات:", err);
    }
}

function formatTime(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs}h ${mins}m ${secs}s`;
}

function hasAdminPermission(interaction) {
    if (interaction.user.id === SUPER_ADMIN_ID) return true;
    return interaction.member.permissions.has(PermissionFlagsBits.Administrator);
}

// 🛡️ حماية السيرفر، الترحيب التلقائي، والتسمية التلقائية بالنيكنيم
client.on('guildMemberAdd', async (member) => {
    try {
        if (member.user.bot && member.id !== CLIENT_ID) {
            await member.kick('حماية السيرفر: غير مسموح بإدخال بوتات خارجية.');
            return;
        }

        const tag = db.settings.prefixTag || 'mars/';
        if (!member.displayName.startsWith(tag)) {
            await member.setNickname(`${tag} ${member.displayName}`);
        }

        // نظام الترحيب التلقائي (Welcome System)
        if (db.settings.logChannel) {
            const logChan = await client.channels.fetch(db.settings.logChannel).catch(() => null);
            if (logChan) {
                const embed = new EmbedBuilder()
                    .setTitle('👋 Welcome to Marsa RP!')
                    .setDescription(`Welcome <@${member.user.id}> to our server! Enjoy your time with us.`)
                    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
                    .setImage(member.guild.iconURL({ dynamic: true }))
                    .setColor(0x00FF7F)
                    .setTimestamp();
                await logChan.send({ embeds: [embed] });
            }
        }
    } catch (e) {}
});

client.once('ready', async () => {
    console.log(`✅ البوت أونلاين ومستعد باسم: ${client.user.tag}`);

    const commands = [
        new SlashCommandBuilder().setName('panel').setDescription('لوحة التحكم الرئيسية للإدارة العليا (Marsa RP)'),
        new SlashCommandBuilder().setName('staffpanel').setDescription('لوحة فريق الدعم والستاف (Marsa RP)'),
        new SlashCommandBuilder().setName('fixnames').setDescription('تحديث أسماء كافة الأعضاء بالنيكنيم المعتمد')
    ].map(cmd => cmd.toJSON());

    const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);
    try {
        await rest.put(
            Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
            { body: commands }
        );
        console.log('🎉 تم تسجيل الأوامر الفورية بنجاح!');
    } catch (error) {
        console.error('خطأ تسجيل الأوامر:', error.message);
    }

    if (db.settings.voice247) {
        try {
            const guild = client.guilds.cache.get(GUILD_ID);
            if (guild) {
                joinVoiceChannel({
                    channelId: db.settings.voice247,
                    guildId: guild.id,
                    adapterCreator: guild.voiceAdapterCreator,
                    selfDeaf: true
                });
            }
        } catch (e) {}
    }

    setInterval(checkDutySchedules, 60000);
});

function checkDutySchedules() {
    const now = new Date();
    if (now.getDay() === 5 && now.getHours() === 23 && now.getMinutes() === 59) {
        sendDutyReport('weekly');
    }
    const isLastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() === now.getDate();
    if (isLastDay && now.getHours() === 23 && now.getMinutes() === 59) {
        sendDutyReport('monthly');
    }
}

async function sendDutyReport(type) {
    if (!db.settings.workChannel) return;
    const channel = await client.channels.fetch(db.settings.workChannel).catch(() => null);
    if (!channel) return;

    const sorted = Object.entries(db.work)
        .sort((a, b) => b[1].totalSeconds - a[1].totalSeconds)
        .slice(0, 10);

    let title = type === 'weekly' ? '📊 التقرير الأسبوعي لدوام الأعضاء' : '📅 التقرير الشهري الإجمالي للدوام';
    let desc = `أكثر الأعضاء نشاطاً وعملاً:\n\n`;

    if (sorted.length === 0) {
        desc += 'لا توجد بيانات دوام مسجلة.';
    } else {
        sorted.forEach(([userId, data], index) => {
            desc += `**#${index + 1}** <@${userId}> ➔ الوقت الإجمالي: **${formatTime(data.totalSeconds)}** (${data.sessions || 0} جلسة)\n`;
        });
    }

    const embed = new EmbedBuilder().setTitle(title).setDescription(desc).setColor(0x2ECC71).setTimestamp();
    await channel.send({ embeds: [embed] });
}

client.on('interactionCreate', async (interaction) => {
    try {
        if (interaction.isChatInputCommand()) {
            if (interaction.commandName === 'fixnames') {
                if (!hasAdminPermission(interaction)) {
                    return interaction.reply({ content: '❌ مخصص للإدارة العليا فقط!', ephemeral: true });
                }

                await interaction.deferReply({ ephemeral: true });
                const members = await interaction.guild.members.fetch();
                const tag = db.settings.prefixTag || 'mars/';
                let changedCount = 0;

                for (const [id, member] of members) {
                    if (member.user.bot) continue;
                    if (!member.displayName.startsWith(tag)) {
                        try {
                            await member.setNickname(`${tag} ${member.displayName}`);
                            changedCount++;
                        } catch (e) {}
                    }
                }

                return await interaction.editReply({ content: `⚙️ تم تحديث أسماء **${changedCount}** عضو بنجاح!` });
            }

            if (interaction.commandName === 'panel') {
                if (!hasAdminPermission(interaction)) {
                    return interaction.reply({ content: '❌ مخصص للإدارة العليا فقط!', ephemeral: true });
                }

                const embed = new EmbedBuilder()
                    .setTitle('📌 لوحة تحكم سيرفر Marsa RP الرئيسية (All-In-One Panel)')
                    .setDescription('اختر النظام والإعداد المراد التحكم به بالكامل:')
                    .setColor(0x00AE86);

                const menu = new StringSelectMenuBuilder()
                    .setCustomId('admin_main_menu')
                    .setPlaceholder('... اختر الخيار المطلوب لإعداده')
                    .addOptions([
                        { label: 'إعداد نظام التقديمات (Applications)', description: 'Dev, Staff, Interview Apps والأسئلة', value: 'opt_setup_apps', emoji: '📝' },
                        { label: 'إعداد نظام تسجيل الدوام والوقت', description: 'نشر زر بدء الوقت والتقارير الأسبوعية/الشهرية', value: 'opt_setup_work_timer', emoji: '⏱️' },
                        { label: 'إعداد قنوات العقوبات (Warn & Ban Channels)', description: 'تحديد آيدي روم الورنات وآيدي روم البان', value: 'opt_setup_sanction_chans', emoji: '🚨' },
                        { label: 'إعداد روم السجلات والترحيب (Logs & Welcome)', description: 'تحديد قناة السجلات العامة والترحيب بالصور', value: 'opt_setup_logs', emoji: '📋' },
                        { label: 'تفعيل إكتيف صوتي 24/7 (Voice Channel)', description: 'دخول البوت لروم صوتي دائماً', value: 'opt_setup_voice_247', emoji: '🔊' },
                        { label: 'إرسال إشعار للجميع بالخاص (Broadcast DM)', description: 'إرسال رسالة جماعية لكل أعضاء السيرفر بالخاص', value: 'opt_setup_broadcast', emoji: '📢' },
                        { label: 'تعديل التسمية التلقائية (Auto-Nickname)', description: 'تغيير البادئة التلقائية للأسماء (النيكنيم)', value: 'opt_setup_nickname_tag', emoji: '🏷️' },
                        { label: 'تحديد تاغ السيرفر (Server Tag)', description: 'تحديد وتغيير التاغ الرسمي للسيرفر', value: 'opt_setup_server_tag', emoji: '👑' }
                    ]);

                return await interaction.reply({ embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)], ephemeral: true });
            }

            if (interaction.commandName === 'staffpanel') {
                const embed = new EmbedBuilder()
                    .setTitle('🛡️ لوحة طاقم الدعم والستاف (Staff Panel)')
                    .setDescription('إدارة العقوبات والسجلات حسب قوانين السيرفر:')
                    .setColor(0xFF0000);

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('btn_open_warn').setLabel('⚠️ تسجيل عقوبة / ورن').setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId('btn_open_ban').setLabel('🔨 تسجيل بان / Ban Log').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('btn_show_rules').setLabel('📜 جدول قوانين المخالفات').setStyle(ButtonStyle.Primary)
                );

                return await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
            }
        }

        if (interaction.isStringSelectMenu() && interaction.customId === 'admin_main_menu') {
            const val = interaction.values[0];

            if (val === 'opt_setup_work_timer') {
                const modal = new ModalBuilder().setCustomId('modal_setup_work_chan').setTitle('إعداد قناة الدوام والتقارير');
                const chan = new TextInputBuilder().setCustomId('work_post_chan').setLabel('آيدي القناة لنشر أزرار الدوام والتقارير').setStyle(TextInputStyle.Short).setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(chan));
                return await interaction.showModal(modal);
            }

            if (val === 'opt_setup_sanction_chans') {
                const modal = new ModalBuilder().setCustomId('modal_setup_sanction_chans').setTitle('إعداد قنوات العقوبات');
                const wChan = new TextInputBuilder().setCustomId('warn_chan_id').setLabel('آيدي قناة الورنات (Warn Channel ID)').setStyle(TextInputStyle.Short).setRequired(true);
                const bChan = new TextInputBuilder().setCustomId('ban_chan_id').setLabel('آيدي قناة البان (Ban Channel ID)').setStyle(TextInputStyle.Short).setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(wChan), new ActionRowBuilder().addComponents(bChan));
                return await interaction.showModal(modal);
            }

            if (val === 'opt_setup_logs') {
                const modal = new ModalBuilder().setCustomId('modal_setup_logs').setTitle('إعداد قناة السجلات والترحيب');
                const lChan = new TextInputBuilder().setCustomId('log_chan_id').setLabel('آيدي قناة السجلات والترحيب (Log Channel)').setStyle(TextInputStyle.Short).setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(lChan));
                return await interaction.showModal(modal);
            }

            if (val === 'opt_setup_apps') {
                const embed = new EmbedBuilder()
                    .setTitle('📝 اختر قسم التقديم المراد تجهيزه')
                    .setDescription('اختر القسم لتحديد قنوات النشر والاستلام والأسئلة:')
                    .setColor(0x3498DB);

                const appMenu = new StringSelectMenuBuilder()
                    .setCustomId('select_app_type')
                    .setPlaceholder('... اختر نوع التقديم')
                    .addOptions([
                        { label: 'Developer Application', description: 'تقديم المطورين', value: 'app_dev', emoji: '💻' },
                        { label: 'Staff Team Application', description: 'تقديم طاقم الستاف', value: 'app_staff', emoji: '🛡️' },
                        { label: 'Interview Team Application', description: 'تقديم فريق الإنترفيو', value: 'app_interview', emoji: '🎙️' }
                    ]);

                return await interaction.reply({ embeds: [embed], components: [new ActionRowBuilder().addComponents(appMenu)], ephemeral: true });
            }

            if (val === 'opt_setup_voice_247') {
                const modal = new ModalBuilder().setCustomId('modal_setup_voice_247').setTitle('تفعيل الصوت 24/7');
                const vChan = new TextInputBuilder().setCustomId('v_chan_id').setLabel('آيدي القناة الصوتية (Voice Channel ID)').setStyle(TextInputStyle.Short).setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(vChan));
                return await interaction.showModal(modal);
            }
        }

        if (interaction.isStringSelectMenu() && interaction.customId === 'select_app_type') {
            const appType = interaction.values[0];
            const modal = new ModalBuilder().setCustomId(`modal_config_app_${appType}`).setTitle('تجهيز التقديم والأسئلة');
            const postChan = new TextInputBuilder().setCustomId('post_chan').setLabel('آيدي القناة لنشر زر التقديم').setStyle(TextInputStyle.Short).setRequired(true);
            const recvChan = new TextInputBuilder().setCustomId('recv_chan').setLabel('آيدي القناة المستقبلة للإجابات').setStyle(TextInputStyle.Short).setRequired(true);
            const questions = new TextInputBuilder().setCustomId('questions_list').setLabel('اكتب الأسئلة (فصل بين كل سؤال بـ ,)').setStyle(TextInputStyle.Paragraph).setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(postChan), new ActionRowBuilder().addComponents(recvChan), new ActionRowBuilder().addComponents(questions));
            return await interaction.showModal(modal);
        }

        if (interaction.isButton()) {
            if (interaction.customId === 'btn_show_rules') {
                const embed = new EmbedBuilder()
                    .setTitle('📜 جدول قوانين المخالفات والعقوبات (Server Penalties Table)')
                    .setDescription(
                        "• **Meta Gaming**: 1st: Warning | 2nd: 1hr kick/mute | 3rd: 1-day ban\n" +
                        "• **Power Gaming**: 1st: Verbal warning | 2nd: 30min kick | 3rd: 1-day ban\n" +
                        "• **Mass RP**: 1st: Warning + scene reset | 2nd: 1-day ban | 3rd: 3-day ban\n" +
                        "• **Cop Baiting / Vehicle Theft**: 1st: Warning | 2nd: 1-day ban | 3rd: 3-day ban\n" +
                        "• **RDM / VDM / Revenge Kill / Power Kill**: 1st: 1-day ban | 2nd: 3-day ban | 3rd: 7-day ban\n" +
                        "• **EMS Sanctity Violation**: 1st: 2-day ban | 2nd: 5-day ban | 3rd: Permanent ban\n" +
                        "• **Combat Logging**: 1st: 3-day ban | 2nd: 7-day ban | 3rd: Permanent ban"
                    )
                    .setColor(0x2B2D31);
                return await interaction.reply({ embeds: [embed], ephemeral: true });
            }

            if (interaction.customId === 'btn_open_warn') {
                const modal = new ModalBuilder().setCustomId('modal_submit_warn').setTitle('تسجيل تحذير / ورن');
                const user = new TextInputBuilder().setCustomId('user_id').setLabel('آيدي العضو المخالف').setStyle(TextInputStyle.Short).setRequired(true);
                const reason = new TextInputBuilder().setCustomId('reason').setLabel('نوع المخالفة والسبب').setStyle(TextInputStyle.Paragraph).setRequired(true);
                const proof = new TextInputBuilder().setCustomId('proof_url').setLabel('رابط صورة الدليل / الإثبات (اختياري)').setStyle(TextInputStyle.Short).setRequired(false);
                modal.addComponents(new ActionRowBuilder().addComponents(user), new ActionRowBuilder().addComponents(reason), new ActionRowBuilder().addComponents(proof));
                return await interaction.showModal(modal);
            }

            if (interaction.customId === 'btn_open_ban') {
                const modal = new ModalBuilder().setCustomId('modal_submit_ban').setTitle('تسجيل حظر / Ban Log');
                const user = new TextInputBuilder().setCustomId('user_id').setLabel('آيدي العضو المحظور').setStyle(TextInputStyle.Short).setRequired(true);
                const duration = new TextInputBuilder().setCustomId('duration').setLabel('مدة البان (مثال: 1-day ban / Permanent)').setStyle(TextInputStyle.Short).setRequired(true);
                const reason = new TextInputBuilder().setCustomId('reason').setLabel('نوع المخالفة والسبب').setStyle(TextInputStyle.Paragraph).setRequired(true);
                const proof = new TextInputBuilder().setCustomId('proof_url').setLabel('رابط صورة الدليل / الإثبات (اختياري)').setStyle(TextInputStyle.Short).setRequired(false);
                modal.addComponents(new ActionRowBuilder().addComponents(user), new ActionRowBuilder().addComponents(duration), new ActionRowBuilder().addComponents(reason), new ActionRowBuilder().addComponents(proof));
                return await interaction.showModal(modal);
            }

            if (interaction.customId === 'btn_start_work') {
                const uid = interaction.user.id;
                if (db.activeWork[uid]) {
                    return await interaction.reply({ content: '⚠️ دوامك يعمل بالفعل ومحسوب حالياً!', ephemeral: true });
                }
                db.activeWork[uid] = Date.now();
                saveDB();
                return await interaction.reply({ content: '🟢 **تم بدء احتساب الوقت بنجاح!** بدأ عداد الساعات الآن.', ephemeral: true });
            }

            if (interaction.customId === 'btn_stop_work') {
                const uid = interaction.user.id;
                if (!db.activeWork[uid]) {
                    return await interaction.reply({ content: '❌ لم تقم ببدء الدوام بعد!', ephemeral: true });
                }
                const startTime = db.activeWork[uid];
                const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
                delete db.activeWork[uid];

                if (!db.work[uid]) db.work[uid] = { totalSeconds: 0, sessions: 0 };
                db.work[uid].totalSeconds += elapsedSeconds;
                db.work[uid].sessions += 1;
                saveDB();

                return await interaction.reply({ 
                    content: `🛑 **تم إيقاف الدوام بنجاح!**\n⏱️ وقت الجلسة: **${formatTime(elapsedSeconds)}**\n📊 المجموع الكلي: **${formatTime(db.work[uid].totalSeconds)}**`, 
                    ephemeral: true 
                });
            }

            if (interaction.customId.startsWith('start_app_btn_')) {
                const appType = interaction.customId.replace('start_app_btn_', '');
                const appData = db.settings.apps[appType];
                if (!appData || !appData.questions || appData.questions.length === 0) {
                    return await interaction.reply({ content: '❌ لم يتم التجهيز بعد!', ephemeral: true });
                }

                const uid = interaction.user.id;
                db.userSessions[uid] = {
                    type: appType,
                    questions: appData.questions,
                    recvChanId: appData.recvChanId,
                    currentStep: 0,
                    answers: []
                };
                saveDB();

                await interaction.reply({ content: '📥 **تم بدء التقديم!** تم إرسال السؤال الأول لك في الخاص (DM).', ephemeral: true });
                try {
                    const dm = await interaction.user.createDM();
                    await dm.send(`مرحباً بك في تقديم **${appType.toUpperCase()}**!\n\n❓ **السؤال (1/${appData.questions.length}):** ${appData.questions[0]}`);
                } catch (e) {
                    await interaction.followUp({ content: '❌ تعذر إرسال رسالة لك بالخاص، يرجى فتح الخاص.', ephemeral: true });
                }
            }
        }

        if (interaction.isModalSubmit()) {
            await interaction.deferReply({ ephemeral: true });

            if (interaction.customId === 'modal_setup_work_chan') {
                const chanId = interaction.fields.getTextInputValue('work_post_chan');
                db.settings.workChannel = chanId;
                saveDB();

                const channel = await client.channels.fetch(chanId).catch(() => null);
                if (channel) {
                    const embed = new EmbedBuilder()
                        .setTitle('⏱️ نظام حساب أوقات الدوام (Duty Hours Counter)')
                        .setDescription('اضغط على **🟢 بدء وقت الدوام** لبدء العداد، وعند الانتهاء اضغط على **🔴 إيقاف الدوام**:\n\n📅 **ملاحظة:** يتم إرسال التقرير الأسبوعي والشهري هنا.')
                        .setColor(0xF39C12);

                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('btn_start_work').setLabel('🟢 بدء وقت الدوام').setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId('btn_stop_work').setLabel('🔴 إيقاف الدوام').setStyle(ButtonStyle.Danger)
                    );
                    await channel.send({ embeds: [embed], components: [row] });
                }
                return await interaction.editReply({ content: '✅ تم نشر زر الدوام والتقارير بنجاح!' });
            }

            if (interaction.customId === 'modal_setup_sanction_chans') {
                db.settings.warnChannel = interaction.fields.getTextInputValue('warn_chan_id');
                db.settings.banChannel = interaction.fields.getTextInputValue('ban_chan_id');
                saveDB();
                return await interaction.editReply({ content: '✅ تم حفظ قنوات الورن والبان بنجاح!' });
            }

            if (interaction.customId === 'modal_setup_logs') {
                db.settings.logChannel = interaction.fields.getTextInputValue('log_chan_id');
                saveDB();
                return await interaction.editReply({ content: '✅ تم حفظ قناة السجلات والترحيب بنجاح!' });
            }

            if (interaction.customId === 'modal_submit_warn') {
                const targetId = interaction.fields.getTextInputValue('user_id');
                const reason = interaction.fields.getTextInputValue('reason');
                const proofUrl = interaction.fields.getTextInputValue('proof_url');

                if (db.settings.warnChannel) {
                    const warnChan = await client.channels.fetch(db.settings.warnChannel).catch(() => null);
                    if (warnChan) {
                        const embed = new EmbedBuilder()
                            .setTitle('⚠️ تسجيل تحذير / ورن جديد (Warn Log)')
                            .setDescription(`👤 **العضو المخالف:** <@${targetId}>\n🛡️ **الستاف المسؤول:** ${interaction.user}\n📜 **المخالفة:** ${reason}`)
                            .setColor(0xE67E22)
                            .setTimestamp();
                        if (proofUrl && proofUrl.startsWith('http')) embed.setImage(proofUrl);
                        await warnChan.send({ content: `<@${targetId}>`, embeds: [embed] });
                    }
                }
                return await interaction.editReply({ content: '✅ تم تسجيل ونشر الورن بنجاح!' });
            }

            if (interaction.customId === 'modal_submit_ban') {
                const targetId = interaction.fields.getTextInputValue('user_id');
                const duration = interaction.fields.getTextInputValue('duration');
                const reason = interaction.fields.getTextInputValue('reason');
                const proofUrl = interaction.fields.getTextInputValue('proof_url');

                if (db.settings.banChannel) {
                    const banChan = await client.channels.fetch(db.settings.banChannel).catch(() => null);
                    if (banChan) {
                        const embed = new EmbedBuilder()
                            .setTitle('🔨 تسجيل حظر جديد (Ban Log)')
                            .setDescription(`👤 **العضو المحظور:** <@${targetId}>\n🛡️ **الستاف المسؤول:** ${interaction.user}\n⏳ **المدة:** ${duration}\n📜 **المخالفة:** ${reason}`)
                            .setColor(0x990000)
                            .setTimestamp();
                        if (proofUrl && proofUrl.startsWith('http')) embed.setImage(proofUrl);
                        await banChan.send({ embeds: [embed] });
                    }
                }
                return await interaction.editReply({ content: '✅ تم تسجيل ونشر البان بنجاح!' });
            }

            if (interaction.customId.startsWith('modal_config_app_')) {
                const appType = interaction.customId.replace('modal_config_app_', '');
                const postChanId = interaction.fields.getTextInputValue('post_chan');
                const recvChanId = interaction.fields.getTextInputValue('recv_chan');
                const rawQuestions = interaction.fields.getTextInputValue('questions_list');
                const questionsArr = rawQuestions.split(',').map(q => q.trim()).filter(q => q.length > 0);

                db.settings.apps[appType] = { postChanId, recvChanId, questions: questionsArr };
                saveDB();

                const postChannel = await client.channels.fetch(postChanId).catch(() => null);
                if (postChannel) {
                    const embed = new EmbedBuilder()
                        .setTitle(`📝 تقديم ${appType.replace('app_', '').toUpperCase()}`)
                        .setDescription('اضغط على الزر بالأسفل للبدء بالتقديم والإجابة عبر الرسائل الخاصة (DM):')
                        .setColor(0x00FF7F);
                    const btn = new ButtonBuilder()
                        .setCustomId(`start_app_btn_${appType}`)
                        .setLabel(`🚀 بدء تقديم ${appType.replace('app_', '').toUpperCase()}`)
                        .setStyle(ButtonStyle.Success);
                    await postChannel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(btn)] });
                }
                return await interaction.editReply({ content: `✅ تم تجهيز ونشر تقديم ${appType.toUpperCase()} بنجاح!` });
            }

            if (interaction.customId === 'modal_setup_voice_247') {
                const vChanId = interaction.fields.getTextInputValue('v_chan_id');
                db.settings.voice247 = vChanId;
                saveDB();
                try {
                    joinVoiceChannel({
                        channelId: vChanId,
                        guildId: interaction.guild.id,
                        adapterCreator: interaction.guild.voiceAdapterCreator,
                        selfDeaf: true
                    });
                    return await interaction.editReply({ content: `✅ تم تفعيل الصوت 24/7 ودخل البوت الروم <#${vChanId}>` });
                } catch (e) {
                    return await interaction.editReply({ content: `❌ تعذر الدخول للقناة الصوتية.` });
                }
            }
        }
    } catch (err) {
        console.error("خطأ التفاعل:", err);
    }
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.channel.isDMBased()) return;

    const uid = message.author.id;
    const session = db.userSessions[uid];

    if (session) {
        session.answers.push(message.content);
        session.currentStep += 1;

        if (session.currentStep < session.questions.length) {
            const nextQ = session.questions[session.currentStep];
            await message.reply(`❓ **السؤال (${session.currentStep + 1}/${session.questions.length}):** ${nextQ}`);
            saveDB();
        } else {
            await message.reply('🎉 **تم استلام جميع إجاباتك بنجاح!** تم إرسال تقديمك للمراجعة.');

            if (session.recvChanId) {
                const targetChan = await client.channels.fetch(session.recvChanId).catch(() => null);
                if (targetChan) {
                    let desc = `👤 **صاحب التقديم:** <@${uid}>\n📋 **نوع التقديم:** \`${session.type.replace('app_', '').toUpperCase()}\`\n\n`;
                    session.questions.forEach((q, idx) => {
                        desc += `**س${idx + 1}: ${q}**\nج: ${session.answers[idx]}\n\n`;
                    });

                    const embed = new EmbedBuilder()
                        .setTitle(`📥 طلب تقديم جديد - ${session.type.replace('app_', '').toUpperCase()}`)
                        .setDescription(desc)
                        .setColor(0x9B59B6)
                        .setTimestamp();
                    await targetChan.send({ embeds: [embed] });
                }
            }
            delete db.userSessions[uid];
            saveDB();
        }
    }
});

process.on('unhandledRejection', error => console.error('استثناء غير معالج:', error));

client.login(MTU2NTAwOTg4NjY4MzcyOTk0MA.GRs3GT.IgfD1xWP5J6LSL4kwZYTtDamvYoCcPpbcQZbn8);
