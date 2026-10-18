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

// 👑 إضافة الـ ID الخاص بك كـ Super Admin يتجاوز كافة صلاحيات ديسكورد
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
        warnChannel: '',
        banChannel: '',
        wInterview: {}, 
        wHelp: {} 
    }, 
    warns: {}, 
    userSessions: {} 
};

if (fs.existsSync(DB_FILE)) {
    try {
        db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
        if (!db.settings) db.settings = {};
        if (!db.settings.apps) db.settings.apps = {};
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

// دالة التحقق من الصلاحية العليا (Super Admin أو Admin)
function hasAdminPermission(interaction) {
    if (interaction.user.id === SUPER_ADMIN_ID) return true;
    return interaction.member.permissions.has(PermissionFlagsBits.Administrator);
}

// 🛑 طرد البوتات الغريبة + التسمية التلقائية بالنيكنيم
client.on('guildMemberAdd', async (member) => {
    try {
        if (member.user.bot && member.id !== CLIENT_ID) {
            await member.kick('حماية السيرفر: غير مسموح بإدخال بوتات خارجية.');
            return;
        }

        const tag = db.settings.prefixTag || 'mars/';
        if (!member.displayName.startsWith(tag)) {
            const newNick = `${tag} ${member.displayName}`;
            await member.setNickname(newNick);
        }
    } catch (e) {
        console.log(`تعذر تغيير اسم العضو: ${member.user.tag}`);
    }
});

client.once('ready', async () => {
    console.log(`✅ البوت أونلاين ومستعد باسم: ${client.user.tag}`);

    const commands = [
        new SlashCommandBuilder().setName('panel').setDescription('لوحة التحكم الرئيسية الإدارية (Marsa RP)'),
        new SlashCommandBuilder().setName('staffpanel').setDescription('لوحة فريق الستاف والعقوبات (Marsa RP)'),
        new SlashCommandBuilder().setName('fixnames').setDescription('تحديث أسماء كافة الأعضاء بالنيكنيم المعتمد')
    ].map(cmd => cmd.toJSON());

    const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);
    try {
        await rest.put(
            Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
            { body: commands }
        );
        console.log('🎉 تم تسجيل الأوامر الفورية للسيرفر!');
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
});

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
                    .setTitle('📌 لوحة تحكم سيرفر Marsa RP الرئيسية')
                    .setDescription('اختر النظام والإعداد المراد التحكم به بالكامل:')
                    .setColor(0x00AE86);

                const menu = new StringSelectMenuBuilder()
                    .setCustomId('admin_main_menu')
                    .setPlaceholder('... اختر الخيار المطلوب لإعداده')
                    .addOptions([
                        { label: 'إعداد نظام التقديمات (Applications)', description: 'Dev, Staff, Interview Apps والأسئلة وقناة الإجابات', value: 'opt_setup_apps', emoji: '📝' },
                        { label: 'إعداد قنوات العقوبات (Warn & Ban Channels)', description: 'تحديد آيدي روم الورنات وآيدي روم البان', value: 'opt_setup_sanction_chans', emoji: '🚨' },
                        { label: 'إعداد إشعارات المقابلات (Interview Notification)', description: 'تحديد روم التنبيه والتاغ وروم النقل', value: 'opt_setup_w_interview', emoji: '🎙️' },
                        { label: 'إعداد إشعارات المساعدة (Waiting Help)', description: 'تحديد روم المساعدة وتاغ الستاف', value: 'opt_setup_w_help', emoji: '❓' },
                        { label: 'تفعيل إكتيف صوتي 24/7 (Voice Channel)', description: 'دخول البوت لروم صوتي دائماً', value: 'opt_setup_voice_247', emoji: '🔊' },
                        { label: 'إرسال إشعار للجميع بالخاص (Broadcast DM)', description: 'إرسال رسالة جماعية لكل أعضاء السيرفر بالخاص', value: 'opt_setup_broadcast', emoji: '📢' },
                        { label: 'إعدادات اسم وصورة البوت (Bot Profile)', description: 'تغيير اسم البوت، زخرفته ورابط صورته', value: 'opt_setup_bot_profile', emoji: '🖼️' },
                        { label: 'تعديل التسمية التلقائية (Auto-Nickname)', description: 'تغيير البادئة التلقائية للأسماء (النيكنيم)', value: 'opt_setup_nickname_tag', emoji: '🏷️' },
                        { label: 'تحديد تاغ السيرفر (Server Tag)', description: 'تحديد وتغيير التاغ الرسمي للسيرفر', value: 'opt_setup_server_tag', emoji: '👑' }
                    ]);

                return await interaction.reply({ embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)], ephemeral: true });
            }

            if (interaction.commandName === 'staffpanel') {
                const embed = new EmbedBuilder()
                    .setTitle('🛡️ لوحة طاقم الدعم والستاف (Staff Panel)')
                    .setDescription('إدارة العقوبات والسجلات وإشعارات الحظر حسب قوانين السيرفر:')
                    .setColor(0xFF0000);

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('btn_open_warn').setLabel('⚠️ تسجيل عقوبة / ورن').setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId('btn_open_ban').setLabel('🔨 تسجيل بان / Ban Log').setStyle(ButtonStyle.Dark),
                    new ButtonBuilder().setCustomId('btn_show_rules').setLabel('📜 جدول قوانين المخالفات').setStyle(ButtonStyle.Secondary)
                );

                return await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
            }
        }

        // القائمة الرئيسية في البانل
        if (interaction.isStringSelectMenu() && interaction.customId === 'admin_main_menu') {
            const val = interaction.values[0];

            if (val === 'opt_setup_sanction_chans') {
                const modal = new ModalBuilder().setCustomId('modal_setup_sanction_chans').setTitle('إعداد قنوات العقوبات');
                const wChan = new TextInputBuilder().setCustomId('warn_chan_id').setLabel('آيدي قناة الورنات (Warn Channel ID)').setStyle(TextInputStyle.Short).setRequired(true);
                const bChan = new TextInputBuilder().setCustomId('ban_chan_id').setLabel('آيدي قناة البان (Ban Channel ID)').setStyle(TextInputStyle.Short).setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(wChan), new ActionRowBuilder().addComponents(bChan));
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

            if (val === 'opt_setup_w_interview') {
                const modal = new ModalBuilder().setCustomId('modal_setup_w_interview').setTitle('إعدادات إشعارات المقابلات');
                const chan = new TextInputBuilder().setCustomId('chan_id').setLabel('آيدي روم التنبيه (Notification Room)').setStyle(TextInputStyle.Short).setRequired(true);
                const role = new TextInputBuilder().setCustomId('role_id').setLabel('آيدي رتبة المنشن (Ping Role)').setStyle(TextInputStyle.Short).setRequired(true);
                const moveVoice = new TextInputBuilder().setCustomId('move_voice_id').setLabel('آيدي روم النقل الصوتي (Move Voice ID)').setStyle(TextInputStyle.Short).setRequired(true);
                
                modal.addComponents(new ActionRowBuilder().addComponents(chan), new ActionRowBuilder().addComponents(role), new ActionRowBuilder().addComponents(moveVoice));
                return await interaction.showModal(modal);
            }

            if (val === 'opt_setup_w_help') {
                const modal = new ModalBuilder().setCustomId('modal_setup_w_help').setTitle('إعدادات إشعارات المساعدة');
                const chan = new TextInputBuilder().setCustomId('chan_id').setLabel('آيدي روم طلب المساعدة').setStyle(TextInputStyle.Short).setRequired(true);
                const role = new TextInputBuilder().setCustomId('role_id').setLabel('آيدي رتبة الستاف (Staff Role Tag)').setStyle(TextInputStyle.Short).setRequired(true);
                
                modal.addComponents(new ActionRowBuilder().addComponents(chan), new ActionRowBuilder().addComponents(role));
                return await interaction.showModal(modal);
            }

            if (val === 'opt_setup_voice_247') {
                const modal = new ModalBuilder().setCustomId('modal_setup_voice_247').setTitle('تفعيل الصوت 24/7');
                const vChan = new TextInputBuilder().setCustomId('v_chan_id').setLabel('آيدي القناة الصوتية (Voice Channel ID)').setStyle(TextInputStyle.Short).setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(vChan));
                return await interaction.showModal(modal);
            }

            if (val === 'opt_setup_broadcast') {
                const modal = new ModalBuilder().setCustomId('modal_setup_broadcast').setTitle('إرسال إشعار جماعي بالخاص');
                const msg = new TextInputBuilder().setCustomId('msg_content').setLabel('نص الرسالة المراد إرسالها للجميع بالخاص').setStyle(TextInputStyle.Paragraph).setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(msg));
                return await interaction.showModal(modal);
            }

            if (val === 'opt_setup_bot_profile') {
                const modal = new ModalBuilder().setCustomId('modal_setup_bot_profile').setTitle('تغيير اسم وصورة البوت');
                const name = new TextInputBuilder().setCustomId('bot_name').setLabel('اسم البوت الجديد والزخرفة').setStyle(TextInputStyle.Short).setRequired(false);
                const avatar = new TextInputBuilder().setCustomId('bot_avatar').setLabel('رابط الصورة الجديدة (Image Direct URL)').setStyle(TextInputStyle.Short).setRequired(false);
                modal.addComponents(new ActionRowBuilder().addComponents(name), new ActionRowBuilder().addComponents(avatar));
                return await interaction.showModal(modal);
            }

            if (val === 'opt_setup_nickname_tag') {
                const modal = new ModalBuilder().setCustomId('modal_setup_nick_tag').setTitle('إعداد التسمية التلقائية (Nickname Tag)');
                const tag = new TextInputBuilder().setCustomId('nick_tag').setLabel('البادئة التلقائية (مثال: mars/)').setStyle(TextInputStyle.Short).setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(tag));
                return await interaction.showModal(modal);
            }

            if (val === 'opt_setup_server_tag') {
                const modal = new ModalBuilder().setCustomId('modal_setup_server_tag').setTitle('تحديد تاغ السيرفر الرسمي');
                const sTag = new TextInputBuilder().setCustomId('server_tag').setLabel('اكتب التاغ الخاص بالسيرفر').setStyle(TextInputStyle.Short).setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(sTag));
                return await interaction.showModal(modal);
            }
        }

        // اختيار قسم التقديمات
        if (interaction.isStringSelectMenu() && interaction.customId === 'select_app_type') {
            const appType = interaction.values[0];

            const modal = new ModalBuilder().setCustomId(`modal_config_app_${appType}`).setTitle('تجهيز التقديم والأسئلة');
            const postChan = new TextInputBuilder().setCustomId('post_chan').setLabel('آيدي القناة لنشر زر التقديم').setStyle(TextInputStyle.Short).setRequired(true);
            const recvChan = new TextInputBuilder().setCustomId('recv_chan').setLabel('آيدي القناة المستقبلة للإجابات').setStyle(TextInputStyle.Short).setRequired(true);
            const questions = new TextInputBuilder().setCustomId('questions_list').setLabel('اكتب الأسئلة (فصل بين كل سؤال بـ ,)').setStyle(TextInputStyle.Paragraph).setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(postChan), new ActionRowBuilder().addComponents(recvChan), new ActionRowBuilder().addComponents(questions));
            return await interaction.showModal(modal);
        }

        // الأزرار المخفية للستاف والعقوبات
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
                    await interaction.followUp({ content: '❌ تعذر إرسال رسالة لك بالخاص، يرجى فتح الخاص في إعدادات الأمان.', ephemeral: true });
                }
            }
        }

        if (interaction.isModalSubmit()) {
            await interaction.deferReply({ ephemeral: true });

            if (interaction.customId === 'modal_setup_sanction_chans') {
                db.settings.warnChannel = interaction.fields.getTextInputValue('warn_chan_id');
                db.settings.banChannel = interaction.fields.getTextInputValue('ban_chan_id');
                saveDB();
                return await interaction.editReply({ content: '✅ تم حفظ قنوات الورن والبان بنجاح!' });
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

                        if (proofUrl && proofUrl.startsWith('http')) {
                            embed.setImage(proofUrl);
                        }

                        await warnChan.send({ content: `<@${targetId}>`, embeds: [embed] });
                    }
                }
                return await interaction.editReply({ content: '✅ تم تسجيل الورن ونشره بالقناة بنجاح!' });
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

                        if (proofUrl && proofUrl.startsWith('http')) {
                            embed.setImage(proofUrl);
                        }

                        await banChan.send({ embeds: [embed] });
                    }
                }
                return await interaction.editReply({ content: '✅ تم تسجيل البان ونشره بالقناة بنجاح!' });
            }

            if (interaction.customId.startsWith('modal_config_app_')) {
                const appType = interaction.customId.replace('modal_config_app_', '');
                const postChanId = interaction.fields.getTextInputValue('post_chan');
                const recvChanId = interaction.fields.getTextInputValue('recv_chan');
                const rawQuestions = interaction.fields.getTextInputValue('questions_list');

                const questionsArr = rawQuestions.split(',').map(q => q.trim()).filter(q => q.length > 0);

                db.settings.apps[appType] = {
                    postChanId,
                    recvChanId,
                    questions: questionsArr
                };
                saveDB();

                const postChannel = await client.channels.fetch(postChanId).catch(() => null);
                if (postChannel) {
                    const embed = new EmbedBuilder()
                        .setTitle(`📝 تقديم ${appType.replace('app_', '').toUpperCase()}`)
                        .setDescription('اضغط على الزر بالأسفل للبدء بالتقديم والإجابة على الأسئلة عبر الرسائل الخاصة (DM):')
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
                    return await interaction.editReply({ content: `✅ تم تفعيل وضع 24/7 ودخل البوت للروم <#${vChanId}>` });
                } catch (e) {
                    return await interaction.editReply({ content: `❌ تعذر الدخول للروم الصوتي، تأكد من الآيدي الصوتي.` });
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

client.login(BOT_TOKEN);
