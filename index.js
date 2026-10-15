const { 
    Client, 
    GatewayIntentBits, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle,
    StringSelectMenuBuilder,
    ChannelSelectMenuBuilder,
    ChannelType,
    AuditLogEvent,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} = require('discord.js');
const { joinVoiceChannel, VoiceConnectionStatus } = require('@discordjs/voice');
const { QuickDB } = require('quick.db');
const db = new QuickDB();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.AutoModeration
    ]
});

// --- إعدادات المعرفات (IDs) ---
const CONFIG = {
    HR_CHANNEL_ID: 'ID_قناة_الـ_HR',
    HR_ROLE_ID: 'ID_رتبة_الـ_HR',
    STAY_VOICE_CHANNEL_ID: 'ID_قناة_الصوت_24_7', // ID روم الفويس الأساسية 24/7
    
    // غرف الانتظار
    WAITING_HELP_CHANNEL_ID: 'ID_Waiting_For_Help',
    MOD_CHANNEL_ID: 'ID_قناة_المودريتور',
    MOD_ROLE_ID: 'ID_رتبة_المودريتور',

    // نظام الانترفيو
    WAITING_INTERVIEW_CHANNEL_ID: '1559232557432709302', // روم الفويس Waiting For Interview
    INTERVIEW_ROLE_ID: '1559217787065467021', // رتبة الانترفيو تيم

    // رومات الفويس الخاصة بالمقابلات
    INTERVIEW_ROOM_1: '1559232643030061086',
    INTERVIEW_ROOM_2: '1559232668166651954',
    INTERVIEW_ROOM_3: '1559232694020214854',
    
    // السجلات والترحيب
    LOG_CHANNEL_ID: 'ID_قناة_السجلات_Logs',
    WELCOME_CHANNEL_ID: 'ID_قناة_ترحيب_الأعضاء',
    ANNOUNCEMENT_CHANNEL_ID: 'ID_قناة_الإعلانات',
    
    // التذاكر
    DEV_ROLE_ID: 'ID_رتبة_المطورين',
    TICKET_CATEGORY_ID: 'ID_قسم_Categories_التذاكر'
};

const AUTO_ROLES = [
    '1559219891469426718',
    '1556688798728069121'
];

const spamMap = new Map();
let activeInterviewNotifyChannelId = null;
let currentVoice247ChannelId = CONFIG.STAY_VOICE_CHANNEL_ID;

// حالات التقديمات
let staffAppStatus = false;
let interviewAppStatus = false;
let devAppStatus = false;

client.once('ready', () => {
    console.log(`✅ البوت جاهز ويعمل باسم: ${client.user.tag}`);
    connectTo247Voice(currentVoice247ChannelId);
});

// 1. الاتصال بالقناة الصوتية 24/7 وإعادة الاتصال التلقائي
function connectTo247Voice(channelId) {
    if (!channelId || channelId.includes('ID_')) return;
    const channel = client.channels.cache.get(channelId);
    if (!channel) return;

    try {
        const connection = joinVoiceChannel({
            channelId: channel.id,
            guildId: channel.guild.id,
            adapterCreator: channel.guild.voiceAdapterCreator,
            selfDeaf: true
        });

        connection.on(VoiceConnectionStatus.Disconnected, () => {
            setTimeout(() => connectTo247Voice(channelId), 5000);
        });
    } catch (err) {
        console.error('خطأ في الاتصال بالصوت 24/7:', err);
    }
}

// 2. الاستجابة للأوامر والكلمات المفتاحية
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    // --- نظام مكافحة روابط السكام والسبام ---
    const contentLower = message.content.toLowerCase();
    const isMrBeastScam = contentLower.includes('mrbeast') && (contentLower.includes('nitro') || contentLower.includes('free') || contentLower.includes('win') || contentLower.includes('gift'));
    if (isMrBeastScam) {
        await message.delete().catch(() => {});
        await message.member.timeout(24 * 60 * 60 * 1000, 'Scam MrBeast').catch(() => {});
        return;
    }

    // --- استدعاء لوحة تحكم البوت عند كتابة "!bot-panel" أو "panel bot" أو "بانل بوت" ---
    const isPanelCommand = message.content === '!bot-panel' || contentLower === 'panel bot' || message.content === 'بانل بوت';
    
    if (isPanelCommand && (message.member.permissions.has('Administrator') || message.member.roles.cache.has(CONFIG.HR_ROLE_ID))) {
        const embed = new EmbedBuilder()
            .setTitle('⚙️ لوحة تحكم البوت الشاملة (Bot Panel)')
            .setDescription(`مرحباً بك في لوحة الإدارة الشاملة، اختر الإجراء الذي تريده من الخيارات والأزرار أدناه:\n\n` +
                            `📌 **حالة التقديمات الحالية:**\n` +
                            `• Staff Application: ${staffAppStatus ? '🟢 **مفتوح**' : '🔴 **مغلق**'}\n` +
                            `• Interview Application: ${interviewAppStatus ? '🟢 **مفتوح**' : '🔴 **مغلق**'}\n` +
                            `• Developer Application: ${devAppStatus ? '🟢 **مفتوح**' : '🔴 **مغلق**'}\n\n` +
                            `🔊 **قناة الفويس 24/7 الحالية:** ${currentVoice247ChannelId && !currentVoice247ChannelId.includes('ID_') ? `<#${currentVoice247ChannelId}>` : '⚠️ لم تفعل بعد'}\n` +
                            `📍 **قناة إشعارات الانترفيو:** ${activeInterviewNotifyChannelId ? `<#${activeInterviewNotifyChannelId}>` : '⚠️ لم تحدد بعد'}`)
            .setColor('#2b2d31');

        const buttonsRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('panel_toggle_staff').setLabel(staffAppStatus ? 'Staff App 🔴' : 'Staff App 🟢').setStyle(staffAppStatus ? ButtonStyle.Danger : ButtonStyle.Success),
            new ButtonBuilder().setCustomId('panel_toggle_interview').setLabel(interviewAppStatus ? 'Interview App 🔴' : 'Interview App 🟢').setStyle(interviewAppStatus ? ButtonStyle.Danger : ButtonStyle.Success),
            new ButtonBuilder().setCustomId('panel_toggle_dev').setLabel(devAppStatus ? 'Developer App 🔴' : 'Developer App 🟢').setStyle(devAppStatus ? ButtonStyle.Danger : ButtonStyle.Success)
        );

        const selectMenuRow = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('panel_select_action')
                .setPlaceholder('اختر خياراً للتحكم بالبوت...')
                .addOptions([
                    { label: 'تفعيل/تغيير فويس 24/7', description: 'إدخال البوت لروم فويس ليبقى فيها 24/7', value: 'set_247_voice', emoji: '🔊' },
                    { label: 'تحديد قناة إشعارات الانترفيو', description: 'تحديد القناة التي يصلها التنبيه بالأزرار', value: 'set_interview_channel', emoji: '🎙️' },
                    { label: 'إرسال إشعار عام للسيرفر', description: 'كتابة إعلان مع منشن للجميع', value: 'send_notification', emoji: '📢' },
                    { label: 'تغيير اسم البوت', description: 'تعديل اسم البوت في ديسكورد', value: 'change_name', emoji: '✏️' },
                    { label: 'تغيير صورة البوت (Avatar)', description: 'تعديل الصورة الشخصية للبوت', value: 'change_avatar', emoji: '🖼️' },
                    { label: 'عرض تقرير ساعات الـ HR', description: 'إرسال الساعات الخاصة بالدوام', value: 'get_hr_report', emoji: '📊' },
                    { label: 'إرسال لوحة بدء/إيقاف الدوام', description: 'إرسال أزرار العمل في القناة', value: 'send_duty_panel', emoji: '💼' },
                    { label: 'إرسال لوحة إنشاء التذاكر', description: 'إرسال لوحة فتح التذاكر', value: 'send_ticket_panel', emoji: '🎫' }
                ])
        );

        await message.channel.send({ embeds: [embed], components: [buttonsRow, selectMenuRow] });
        message.delete().catch(() => {});
    }
});

// 3. التعامل مع تفاعلات اللوحة والأزرار وقوائم الاختيار
client.on('interactionCreate', async (interaction) => {
    // --- نقل العضو فور الضغط على زر الروم الصوتية ---
    if (interaction.isButton() && interaction.customId.startsWith('move_interview_')) {
        const targetUserId = interaction.customId.split('_')[2];
        const targetRoomId = interaction.customId.split('_')[3];

        const targetMember = await interaction.guild.members.fetch(targetUserId).catch(() => null);
        if (!targetMember || !targetMember.voice.channel) {
            return interaction.reply({ content: '❌ العضو لم يعد موجوداً في القناة الصوتية!', ephemeral: true });
        }

        try {
            await targetMember.voice.setChannel(targetRoomId);
            await interaction.reply({ content: `✅ تم نقل **${targetMember.user.tag}** بنجاح إلى الروم الصوتية <#${targetRoomId}>!`, ephemeral: true });
        } catch (error) {
            await interaction.reply({ content: `❌ حدث خطأ أثناء النقل: ${error.message}`, ephemeral: true });
        }
    }

    // --- الأزرار السريعة لتغيير حالة التقديمات ---
    if (interaction.isButton()) {
        if (interaction.customId === 'panel_toggle_staff') {
            staffAppStatus = !staffAppStatus;
            await interaction.reply({ content: `✅ Staff Application: **${staffAppStatus ? 'مفتوح 🟢' : 'مغلق 🔴'}**`, ephemeral: true });
        }
        if (interaction.customId === 'panel_toggle_interview') {
            interviewAppStatus = !interviewAppStatus;
            await interaction.reply({ content: `✅ Interview Application: **${interviewAppStatus ? 'مفتوح 🟢' : 'مغلق 🔴'}**`, ephemeral: true });
        }
        if (interaction.customId === 'panel_toggle_dev') {
            devAppStatus = !devAppStatus;
            await interaction.reply({ content: `✅ Developer Application: **${devAppStatus ? 'مفتوح 🟢' : 'مغلق 🔴'}**`, ephemeral: true });
        }
    }

    // --- القائمة المنسدلة للوحة التحكم ---
    if (interaction.isStringSelectMenu() && interaction.customId === 'panel_select_action') {
        const selectedValue = interaction.values[0];

        if (selectedValue === 'set_247_voice') {
            const modal = new ModalBuilder().setCustomId('modal_set_247_voice').setTitle('تفعيل روم فويس 24/7');
            const voiceInput = new TextInputBuilder().setCustomId('input_voice_id').setLabel('ضع ID روم الفويس هنا').setStyle(TextInputStyle.Short).setRequired(true);
            modal.addComponents(new ActionRowBuilder().addComponents(voiceInput));
            await interaction.showModal(modal);

        } else if (selectedValue === 'set_interview_channel') {
            const channelSelectRow = new ActionRowBuilder().addComponents(
                new ChannelSelectMenuBuilder()
                    .setCustomId('select_interview_notify_channel')
                    .setPlaceholder('اختر القناة المخصصة لإشعارات الانترفيو...')
                    .setChannelTypes(ChannelType.GuildText)
            );
            await interaction.reply({ content: '📌 اختر القناة التي تريد أن تصل إليها إشعارات الانترفيو وتظهر بها أزرار النقل:', components: [channelSelectRow], ephemeral: true });

        } else if (selectedValue === 'send_notification') {
            const modal = new ModalBuilder().setCustomId('modal_send_notification').setTitle('إرسال إشعار عام');
            const titleInput = new TextInputBuilder().setCustomId('input_notif_title').setLabel('عنوان الإشعار').setStyle(TextInputStyle.Short).setRequired(true);
            const bodyInput = new TextInputBuilder().setCustomId('input_notif_body').setLabel('نص الرسالة / الإشعار').setStyle(TextInputStyle.Paragraph).setRequired(true);
            modal.addComponents(new ActionRowBuilder().addComponents(titleInput), new ActionRowBuilder().addComponents(bodyInput));
            await interaction.showModal(modal);

        } else if (selectedValue === 'change_name') {
            const modal = new ModalBuilder().setCustomId('modal_change_name').setTitle('تغيير اسم البوت');
            const nameInput = new TextInputBuilder().setCustomId('input_bot_name').setLabel('الاسم الجديد').setStyle(TextInputStyle.Short).setRequired(true);
            modal.addComponents(new ActionRowBuilder().addComponents(nameInput));
            await interaction.showModal(modal);

        } else if (selectedValue === 'change_avatar') {
            const modal = new ModalBuilder().setCustomId('modal_change_avatar').setTitle('تغيير صورة البوت');
            const avatarInput = new TextInputBuilder().setCustomId('input_bot_avatar').setLabel('رابط الصورة المباشر (URL)').setStyle(TextInputStyle.Short).setRequired(true);
            modal.addComponents(new ActionRowBuilder().addComponents(avatarInput));
            await interaction.showModal(modal);

        } else if (selectedValue === 'get_hr_report') {
            const allData = await db.all();
            const userEntries = allData.filter(item => item.id.startsWith('work_time_'));
            if (userEntries.length === 0) return interaction.reply({ content: '⚠️ لا يوجد سجل ساعات عمل مخزن حالياً.', ephemeral: true });

            let reportDescription = '';
            for (const entry of userEntries) {
                const uId = entry.id.replace('work_time_', '');
                const totalMinutes = entry.value || 0;
                reportDescription += `👤 <@${uId}> : **${(totalMinutes / 60).toFixed(2)} ساعة** (${totalMinutes} دقيقة)\n`;
            }
            const embed = new EmbedBuilder().setTitle('📊 تقرير ساعات عمل الـ HR').setDescription(reportDescription).setColor('Blue');
            await interaction.reply({ embeds: [embed], ephemeral: true });

        } else if (selectedValue === 'send_duty_panel') {
            const embed = new EmbedBuilder().setTitle('💼 نظام تسجيل الدوام والعمل').setDescription('اضغط على الأزرار أدناه لتسجيل **بدء العمل** أو **إيقاف العمل**.').setColor('#2b2d31');
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('start_work').setLabel('بدء العمل').setStyle(ButtonStyle.Success).setEmoji('🟢'),
                new ButtonBuilder().setCustomId('stop_work').setLabel('إيقاف العمل').setStyle(ButtonStyle.Danger).setEmoji('🔴')
            );
            await interaction.channel.send({ embeds: [embed], components: [row] });
            await interaction.reply({ content: '✅ تم إرسال لوحة الدوام بنجاح!', ephemeral: true });

        } else if (selectedValue === 'send_ticket_panel') {
            const embed = new EmbedBuilder().setTitle('🎫 نظام التذاكر والدعم الفني').setDescription('اختر القسم المناسب لفتح تذكرة وسيتم التجاوب معك فوراً.').setColor('#5865F2');
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('ticket_interview').setLabel('Interview').setStyle(ButtonStyle.Primary).setEmoji('🎙️'),
                new ButtonBuilder().setCustomId('ticket_dev').setLabel('Developer').setStyle(ButtonStyle.Secondary).setEmoji('💻'),
                new ButtonBuilder().setCustomId('ticket_staff').setLabel('Staff Team').setStyle(ButtonStyle.Success).setEmoji('🛡️'),
                new ButtonBuilder().setCustomId('ticket_general').setLabel('Support Général').setStyle(ButtonStyle.Secondary).setEmoji('💬')
            );
            await interaction.channel.send({ embeds: [embed], components: [row] });
            await interaction.reply({ content: '✅ تم إرسال لوحة التذاكر بنجاح!', ephemeral: true });
        }
    }

    // --- حفظ القناة المحددة لإشعارات الانترفيو عند اختيارها من القائمة ---
    if (interaction.isChannelSelectMenu() && interaction.customId === 'select_interview_notify_channel') {
        const selectedChannelId = interaction.values[0];
        activeInterviewNotifyChannelId = selectedChannelId;

        await interaction.reply({
            content: `✅ تم اعتماد القناة <#${selectedChannelId}> بنجاح كقناة مخصصة لإشعارات فريق الانترفيو!`,
            ephemeral: true
        });
    }

    // --- تنفيذ إدخالات النصوص (Modals) ---
    if (interaction.isModalSubmit()) {
        if (interaction.customId === 'modal_set_247_voice') {
            const newVoiceId = interaction.fields.getTextInputValue('input_voice_id');
            currentVoice247ChannelId = newVoiceId;
            connectTo247Voice(newVoiceId);
            await interaction.reply({ content: `✅ تم ربط البوت بالروم الصوتية <#${newVoiceId}> وسيبقى فيها 24/7!`, ephemeral: true });
        }

        if (interaction.customId === 'modal_send_notification') {
            const notifTitle = interaction.fields.getTextInputValue('input_notif_title');
            const notifBody = interaction.fields.getTextInputValue('input_notif_body');
            const announceChannel = interaction.guild.channels.cache.get(CONFIG.ANNOUNCEMENT_CHANNEL_ID) || interaction.channel;

            const embed = new EmbedBuilder().setTitle(`📢 ${notifTitle}`).setDescription(notifBody).setColor('Gold').setTimestamp();
            await announceChannel.send({ content: '@everyone', embeds: [embed] });
            await interaction.reply({ content: '✅ تم إرسال الإشعار بنجاح!', ephemeral: true });
        }

        if (interaction.customId === 'modal_change_name') {
            const newName = interaction.fields.getTextInputValue('input_bot_name');
            await client.user.setUsername(newName);
            await interaction.reply({ content: `✅ تم تغيير اسم البوت إلى: **${newName}**`, ephemeral: true });
        }

        if (interaction.customId === 'modal_change_avatar') {
            const newAvatarUrl = interaction.fields.getTextInputValue('input_bot_avatar');
            await client.user.setAvatar(newAvatarUrl);
            await interaction.reply({ content: '✅ تم تغيير صورة البوت بنجاح!', ephemeral: true });
        }
    }

    // --- تفاعلات أزرار الخدمة والتذاكر ---
    const hrChannel = interaction.guild?.channels.cache.get(CONFIG.HR_CHANNEL_ID);
    const dbKeyStart = `start_time_${interaction.user.id}`;
    const dbKeyTotal = `work_time_${interaction.user.id}`;

    if (interaction.customId === 'start_work') {
        const activeStart = await db.get(dbKeyStart);
        if (activeStart) return interaction.reply({ content: '❌ أنت بالفعل في حالة عمل حالياً!', ephemeral: true });
        await db.set(dbKeyStart, Date.now());
        await interaction.reply({ content: '✅ تم تسجيل بدء دوامك بنجاح!', ephemeral: true });
        if (hrChannel) hrChannel.send({ embeds: [new EmbedBuilder().setTitle('🟢 بدء دوام جديد').setDescription(`العضو: ${interaction.user}`).setColor('Green').setTimestamp()] });
    } else if (interaction.customId === 'stop_work') {
        const startTime = await db.get(dbKeyStart);
        if (!startTime) return interaction.reply({ content: '❌ أنت لست في حالة عمل لتوقفه!', ephemeral: true });
        const durationMinutes = Math.floor((Date.now() - startTime) / 1000 / 60);
        await db.delete(dbKeyStart);
        await db.add(dbKeyTotal, durationMinutes);
        await interaction.reply({ content: `🔴 تم إيقاف عملك (${durationMinutes} دقيقة).`, ephemeral: true });
        if (hrChannel) hrChannel.send({ embeds: [new EmbedBuilder().setTitle('🔴 إنهاء دوام').setDescription(`العضو: ${interaction.user}\nالمدة: ${durationMinutes} دقيقة`).setColor('Red').setTimestamp()] });
    }

    // إنشاء وإغلاق التذاكر
    if (interaction.customId.startsWith('ticket_')) {
        const ticketTypeName = interaction.customId.replace('ticket_', '');
        const channel = await interaction.guild.channels.create({
            name: `ticket-${ticketTypeName}-${interaction.member.user.username}`,
            type: 0,
            parent: CONFIG.TICKET_CATEGORY_ID,
            permissionOverwrites: [
                { id: interaction.guild.id, denied: ['ViewChannel'] },
                { id: interaction.member.id, allowed: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] },
                { id: CONFIG.MOD_ROLE_ID, allowed: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] }
            ],
        });
        await interaction.reply({ content: `✅ تم إنشاء التذكرة: ${channel}`, ephemeral: true });
        const closeRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('close_ticket').setLabel('إغلاق التذكرة').setStyle(ButtonStyle.Danger).setEmoji('🔒'));
        await channel.send({ content: `<@&${CONFIG.MOD_ROLE_ID}>`, embeds: [new EmbedBuilder().setTitle(`🎫 تذكرة: ${ticketTypeName.toUpperCase()}`).setDescription(`أهلاً بك ${interaction.member}، سيقوم أحد أعضاء الفريق بالرد عليك.`).setColor('Blurple')], components: [closeRow] });
    }

    if (interaction.customId === 'close_ticket') {
        await interaction.reply({ content: '🔒 سيتم إغلاق التذكرة خلال 5 ثوانٍ...' });
        setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
    }
});

// 4. الترحيب والأعضاء الجدد والرتب التلقائية
client.on('guildMemberAdd', async (member) => {
    if (member.user.bot) return;
    try {
        await member.roles.add(AUTO_ROLES);
    } catch (e) {}

    const welcomeChannel = member.guild.channels.cache.get(CONFIG.WELCOME_CHANNEL_ID);
    if (welcomeChannel) {
        welcomeChannel.send({ embeds: [new EmbedBuilder().setTitle('👋 مرحباً بك!').setDescription(`أهلاً بك ${member} في السيرفر!`).setColor('Green').setThumbnail(member.user.displayAvatarURL()).setTimestamp()] });
    }
});

// 5. استشعار دخول العضو لغرفة الانتظار وإرسال الإشعار وأزرار النقل
client.on('voiceStateUpdate', async (oldState, newState) => {
    if (!newState.channelId || oldState.channelId === newState.channelId) return;
    const member = newState.member;

    if (newState.channelId === CONFIG.WAITING_INTERVIEW_CHANNEL_ID) {
        const targetChannelId = activeInterviewNotifyChannelId || CONFIG.INTERVIEW_CHANNEL_ID;
        const notifyChannel = newState.guild.channels.cache.get(targetChannelId);

        if (notifyChannel) {
            const embed = new EmbedBuilder()
                .setTitle('🎙️ عضو جديد في قائمة الانتظار')
                .setDescription(`العضو ${member} (${member.user.tag}) دخل الآن إلى روم **Waiting For Interview**.\n\nاضغط على أحد الأزرار أدناه لنقله تلقائياً إلى الغرفة المناسبة:`)
                .setColor('Blue')
                .setTimestamp();

            const moveButtonsRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`move_interview_${member.id}_${CONFIG.INTERVIEW_ROOM_1}`).setLabel('نقل -> Room 1').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId(`move_interview_${member.id}_${CONFIG.INTERVIEW_ROOM_2}`).setLabel('نقل -> Room 2').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId(`move_interview_${member.id}_${CONFIG.INTERVIEW_ROOM_3}`).setLabel('نقل -> Room 3').setStyle(ButtonStyle.Success)
            );

            await notifyChannel.send({
                content: `<@&${CONFIG.INTERVIEW_ROLE_ID}>`,
                embeds: [embed],
                components: [moveButtonsRow]
            });
        }
    }
});

client.login('1560278126242562149');
