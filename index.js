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
    console.error("❌ BOT_TOKEN غير موجود!");
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
    settings: { waitingInterview: {}, waitingHelp: {}, tickets: {} }, 
    warns: {}, 
    work: {}, 
    activeWork: {}, 
    userSessions: {} 
};

if (fs.existsSync(DB_FILE)) {
    try {
        db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
        if (!db.settings) db.settings = { waitingInterview: {}, waitingHelp: {}, tickets: {} };
        if (!db.warns) db.warns = {};
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

// تغيير اسم أي عضو يدخل تلقائياً إلى mars/
client.on('guildMemberAdd', async (member) => {
    try {
        if (!member.displayName.startsWith('mars/')) {
            const newNick = `mars/ ${member.displayName}`;
            await member.setNickname(newNick);
        }
    } catch (e) {
        console.log(`تعذر تغيير اسم العضو ${member.user.tag}`);
    }
});

client.once('ready', async () => {
    console.log(`✅ البوت أونلاين ومستعد باسم: ${client.user.tag}`);

    const commands = [
        new SlashCommandBuilder().setName('panel').setDescription('لوحة التحكم الرئيسية للإدارة العليا (Marsa RP)'),
        new SlashCommandBuilder().setName('staffpanel').setDescription('لوحة فريق الدعم والستاف (Marsa RP)'),
        new SlashCommandBuilder().setName('fixnames').setDescription('تغيير أسماء جميع الأعضاء الموجودين إلى mars/ Nickname')
    ].map(cmd => cmd.toJSON());

    const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);
    try {
        await rest.put(
            Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
            { body: commands }
        );
        console.log('🎉 تم تسجيل الأوامر الفورية!');
    } catch (error) {
        console.error('خطأ تسجيل الأوامر:', error.message);
    }

    // فحص تقارير الدوام الأسبوعية والشهرية
    setInterval(checkDutySchedules, 60000); 
});

function checkDutySchedules() {
    const now = new Date();
    // تقرير أسبوعي كل يوم جمعة الساعة 23:59
    if (now.getDay() === 5 && now.getHours() === 23 && now.getMinutes() === 59) {
        sendDutyReport('weekly');
    }
    // تقرير شهري نهاية الشهر
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

    let title = type === 'weekly' ? '📊 التقرير الأسبوعي لدوام الأعضاء (Weekly Duty Top)' : '📅 التقرير الشهري الإجمالي للدوام (Monthly Duty Top)';
    let desc = `أكثر الأعضاء نشاطاً وعملاً خلال هذه الفترة:\n\n`;

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
                if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                    return interaction.reply({ content: '❌ هذا الأمر مخصص للإدارة العليا فقط!', ephemeral: true });
                }

                await interaction.deferReply({ ephemeral: true });
                const members = await interaction.guild.members.fetch();
                let changedCount = 0;

                for (const [id, member] of members) {
                    if (member.user.bot) continue;
                    if (!member.displayName.startsWith('mars/')) {
                        try {
                            await member.setNickname(`mars/ ${member.displayName}`);
                            changedCount++;
                        } catch (e) {}
                    }
                }

                return await interaction.editReply({ content: `⚙️ تم تحديث أسماء **${changedCount}** عضو بنجاح!` });
            }

            if (interaction.commandName === 'panel') {
                if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                    return interaction.reply({ content: '❌ مخصص للإدارة العليا فقط!', ephemeral: true });
                }

                const embed = new EmbedBuilder()
                    .setTitle('📌 لوحة تحكم سيرفر Marsa RP الرئيسية')
                    .setDescription('اختر الخيار المطلوب من القائمة المنسدلة بالأسفل:')
                    .setColor(0x00AE86);

                const menu = new StringSelectMenuBuilder()
                    .setCustomId('admin_main_menu')
                    .setPlaceholder('... اختر خيار الإعداد والتحكم')
                    .addOptions([
                        { label: 'إعداد Waiting for Interview', description: 'تحديد القناة، ورتبة المنشن', value: 'opt_setup_w_interview', emoji: '🎙️' },
                        { label: 'إعداد Waiting for Help', description: 'تحديد قناة المساعدة ورتبة الدعم', value: 'opt_setup_w_help', emoji: '❓' },
                        { label: 'إعداد نظام التذاكر (Ticket Setup)', description: 'إنشاء تكت Dev App, Staff, Interview وتحديد الأسئلة', value: 'opt_setup_tickets', emoji: '🎫' },
                        { label: 'إعداد نظام تسجيل الدوام والوقت', description: 'نشر زر بدء الوقت والتقارير الأسبوعية/الشهري', value: 'opt_setup_work_timer', emoji: '⏱️' }
                    ]);

                return await interaction.reply({ embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)], ephemeral: true });
            }

            if (interaction.commandName === 'staffpanel') {
                if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
                    return interaction.reply({ content: '❌ مخصص لفريق الستاف فقط!', ephemeral: true });
                }

                const embed = new EmbedBuilder()
                    .setTitle('🛡️ لوحة طاقم الدعم (Staff Panel)')
                    .setDescription('إدارة التنبيهات والسجلات:')
                    .setColor(0xFF0000);

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('btn_open_warn').setLabel('⚠️ تسجيل عقوبة / ورن').setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId('btn_check_history').setLabel('🔍 فحص سجل العضو').setStyle(ButtonStyle.Primary)
                );

                return await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
            }
        }

        if (interaction.isStringSelectMenu() && interaction.customId === 'admin_main_menu') {
            const val = interaction.values[0];

            if (val === 'opt_setup_w_interview') {
                const modal = new ModalBuilder().setCustomId('modal_w_interview').setTitle('إعداد Waiting for Interview');
                const chan = new TextInputBuilder().setCustomId('w_int_chan').setLabel('آيدي القناة (Channel ID)').setStyle(TextInputStyle.Short).setRequired(true);
                const role = new TextInputBuilder().setCustomId('w_int_role').setLabel('آيدي الرتبة للتنبيه (Role ID)').setStyle(TextInputStyle.Short).setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(chan), new ActionRowBuilder().addComponents(role));
                return await interaction.showModal(modal);
            }

            if (val === 'opt_setup_w_help') {
                const modal = new ModalBuilder().setCustomId('modal_w_help').setTitle('إعداد Waiting for Help');
                const chan = new TextInputBuilder().setCustomId('w_help_chan').setLabel('آيدي القناة (Channel ID)').setStyle(TextInputStyle.Short).setRequired(true);
                const role = new TextInputBuilder().setCustomId('w_help_role').setLabel('آيدي رتبة الدعم (Role ID)').setStyle(TextInputStyle.Short).setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(chan), new ActionRowBuilder().addComponents(role));
                return await interaction.showModal(modal);
            }

            if (val === 'opt_setup_tickets') {
                const modal = new ModalBuilder().setCustomId('modal_ticket_setup').setTitle('إعداد نظام التذاكر والأسئلة');
                const chan = new TextInputBuilder().setCustomId('t_post_chan').setLabel('آيدي القناة لنشر أزرار التذاكر').setStyle(TextInputStyle.Short).setRequired(true);
                const logChan = new TextInputBuilder().setCustomId('t_recv_chan').setLabel('آيدي القناة المستقبلة للإجابات').setStyle(TextInputStyle.Short).setRequired(true);
                const role = new TextInputBuilder().setCustomId('t_support_role').setLabel('آيدي الرتبة المستقبلة (Role ID)').setStyle(TextInputStyle.Short).setRequired(true);
                const qCount = new TextInputBuilder().setCustomId('t_questions_list').setLabel('اكتب الأسئلة (مفصولة بفاصلة ,)').setStyle(TextInputStyle.Paragraph).setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(chan), new ActionRowBuilder().addComponents(logChan), new ActionRowBuilder().addComponents(role), new ActionRowBuilder().addComponents(qCount));
                return await interaction.showModal(modal);
            }

            if (val === 'opt_setup_work_timer') {
                const modal = new ModalBuilder().setCustomId('modal_setup_work_chan').setTitle('قناة زر الدوام وحاسبة الوقت');
                const chan = new TextInputBuilder().setCustomId('work_post_chan').setLabel('آيدي القناة لنشر زر الدوام').setStyle(TextInputStyle.Short).setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(chan));
                return await interaction.showModal(modal);
            }
        }

        if (interaction.isButton()) {
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
                    content: `🛑 **تم إيقاف الدوام بنجاح!**\n⏱️ الوقت المسجل لهذه الجلسة: **${formatTime(elapsedSeconds)}**\n📊 مجموع أوقاتك الكلي: **${formatTime(db.work[uid].totalSeconds)}**`, 
                    ephemeral: true 
                });
            }

            if (interaction.customId === 'btn_open_ticket_menu') {
                const embed = new EmbedBuilder()
                    .setTitle('🎫 اختر قسم التذكرة التي ترغب بفتحها')
                    .setDescription('يرجى اختيار القسم المناسب، وسيقوم البوت بمراسلتك في الخاص للبدء بالإجابة على الأسئلة:')
                    .setColor(0x3498DB);

                const menu = new StringSelectMenuBuilder()
                    .setCustomId('select_ticket_type')
                    .setPlaceholder('... اختر الفريق المستهدف')
                    .addOptions([
                        { label: 'Developer Team Ticket', description: 'تذكرة خاصة بتقديم أو مشاكل المطورين', value: 'ticket_dev', emoji: '💻' },
                        { label: 'Staff Team Ticket', description: 'تذكرة خاصة بطاقم الإدارة والستاف', value: 'ticket_staff', emoji: '🛡️' },
                        { label: 'Interview Team Ticket', description: 'تذكرة خاصة بالمقابلات الشخصية والإنترفيو', value: 'ticket_interview', emoji: '🎙️' }
                    ]);

                return await interaction.reply({ embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)], ephemeral: true });
            }
        }

        if (interaction.isStringSelectMenu() && interaction.customId === 'select_ticket_type') {
            const ticketType = interaction.values[0];
            const uid = interaction.user.id;
            const questions = db.settings.tickets?.questions || ["ما هو اسمك وعمرك؟", "ما هي خبرتك السابقة في الرول بلاي؟"];

            db.userSessions[uid] = {
                type: ticketType,
                questions: questions,
                currentStep: 0,
                answers: []
            };
            saveDB();

            await interaction.reply({ content: '📥 **تم بدء التذكرة!** افحص رسائلك الخاصة (DM) الآن للإجابة على الأسئلة.', ephemeral: true });

            try {
                const dm = await interaction.user.createDM();
                await dm.send(`مرحباً بك! لقد اخترت تذكرة **${ticketType.toUpperCase()}**.\n\n❓ **السؤال الأول (1/${questions.length}):** ${questions[0]}`);
            } catch (e) {
                await interaction.followUp({ content: '❌ تعذر إرسال رسالة لك بالخاص، يرجى فتح الرسائل الخاصة.', ephemeral: true });
            }
        }

        if (interaction.isModalSubmit()) {
            await interaction.deferReply({ ephemeral: true });

            if (interaction.customId === 'modal_w_interview') {
                db.settings.waitingInterview = {
                    chanId: interaction.fields.getTextInputValue('w_int_chan'),
                    roleId: interaction.fields.getTextInputValue('w_int_role')
                };
                saveDB();
                return await interaction.editReply({ content: '✅ تم ضبط إعدادات Waiting for Interview بنجاح!' });
            }

            if (interaction.customId === 'modal_w_help') {
                db.settings.waitingHelp = {
                    chanId: interaction.fields.getTextInputValue('w_help_chan'),
                    roleId: interaction.fields.getTextInputValue('w_help_role')
                };
                saveDB();
                return await interaction.editReply({ content: '✅ تم ضبط إعدادات Waiting for Help بنجاح!' });
            }

            if (interaction.customId === 'modal_ticket_setup') {
                const postChanId = interaction.fields.getTextInputValue('t_post_chan');
                const recvChanId = interaction.fields.getTextInputValue('t_recv_chan');
                const roleId = interaction.fields.getTextInputValue('t_support_role');
                const rawQuestions = interaction.fields.getTextInputValue('t_questions_list');

                const questionsArr = rawQuestions.split(',').map(q => q.trim()).filter(q => q.length > 0);

                db.settings.tickets = { postChanId, recvChanId, roleId, questions: questionsArr };
                saveDB();

                const postChannel = await client.channels.fetch(postChanId).catch(() => null);
                if (postChannel) {
                    const embed = new EmbedBuilder()
                        .setTitle('🎫 نظام فتح التذاكر والإنترفيو (Ticket System)')
                        .setDescription('اضغط على الزر بالأسفل لاختيار نوع التذكرة والبدء بالإجابة على الأسئلة في الخاص:')
                        .setColor(0x00FF7F);

                    const btn = new ButtonBuilder().setCustomId('btn_open_ticket_menu').setLabel('📩 فتح تذكرة جديدة').setStyle(ButtonStyle.Primary);
                    await postChannel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(btn)] });
                }

                return await interaction.editReply({ content: '✅ تم نشر نظام التذاكر بنجاح في القناة المحددة!' });
            }

            if (interaction.customId === 'modal_setup_work_chan') {
                const chanId = interaction.fields.getTextInputValue('work_post_chan');
                db.settings.workChannel = chanId;
                saveDB();

                const channel = await client.channels.fetch(chanId).catch(() => null);
                if (channel) {
                    const embed = new EmbedBuilder()
                        .setTitle('⏱️ نظام حساب أوقات الدوام الساعي (Duty Hours Counter)')
                        .setDescription('اضغط على **🟢 بدء وقت الدوام** لبدء العداد تلقائياً، وعند انتهائك اضغط على **🔴 إيقاف الدوام** لحساب الإجمالي:')
                        .setColor(0xF39C12);

                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('btn_start_work').setLabel('🟢 بدء وقت الدوام').setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId('btn_stop_work').setLabel('🔴 إيقاف الدوام').setStyle(ButtonStyle.Danger)
                    );

                    await channel.send({ embeds: [embed], components: [row] });
                }

                return await interaction.editReply({ content: '✅ تم نشر زر تسجيل الدوام وحساب الساعات بنجاح!' });
            }
        }
    } catch (err) {
        console.error("خطأ التفاعل:", err);
    }
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.channel.isDMBased()) return;

    const uid =
