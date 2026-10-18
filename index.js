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
const GUILD_ID  = '1559798237743808535';

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
    settings: { apps: {}, voice247: '', workChannel: '', waitingInterview: {}, waitingHelp: {} }, 
    warns: {}, 
    work: {}, 
    activeWork: {}, 
    userSessions: {} 
};

if (fs.existsSync(DB_FILE)) {
    try {
        db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
        if (!db.settings) db.settings = { apps: {}, voice247: '', workChannel: '', waitingInterview: {}, waitingHelp: {} };
        if (!db.settings.apps) db.settings.apps = {};
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

// تغيير اسم العضو الجديد تلقائياً عند الدخول إلى mars/
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
        new SlashCommandBuilder().setName('fixnames').setDescription('تغيير أسماء جميع الأعضاء إلى mars/ Nickname')
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

    // الاتصال الصوتي 24/7
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
                console.log("🔊 تم الاتصال بالروم الصوتي 24/7 بنجاح!");
            }
        } catch (e) {
            console.log("خطأ الاتصال الصوتي 24/7:", e.message);
        }
    }

    // فحص تقارير الدوام كل دقيقة
    setInterval(checkDutySchedules, 60000); 
});

function checkDutySchedules() {
    const now = new Date();
    // تقرير أسبوعي كل يوم جمعة الساعة 23:59
    if (now.getDay() === 5 && now.getHours() === 23 && now.getMinutes() === 59) {
        sendDutyReport('weekly');
    }
    // تقرير شهري في أخر يوم من الشهر
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

    let title = type === 'weekly' ? '📊 التقرير الأسبوعي لدوام الأعضاء (Weekly Duty Leaderboard)' : '📅 التقرير الشهري الإجمالي لدوام الأعضاء (Monthly Duty Leaderboard)';
    let desc = `إليك أكثر الأعضاء نشاطاً وحضوراً خلال هذه الفترة:\n\n`;

    if (sorted.length === 0) {
        desc += 'لا توجد بيانات دوام مسجلة.';
    } else {
        sorted.forEach(([userId, data], index) => {
            desc += `**#${index + 1}** <@${userId}> ➔ الوقت الإجمالي: **${formatTime(data.totalSeconds)}** (${data.sessions || 0} جلسة عمل)\n`;
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
                    return interaction.reply({ content: '❌ مخصص للإدارة العليا فقط!', ephemeral: true });
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
                    .setTitle('📌 لوحة تحكم سيرفر Marsa RP الرئيسية (All-In-One Panel)')
                    .setDescription('اختر النظام والإعداد المراد التحكم به بالكامل من القائمة بالأسفل:')
                    .setColor(0x00AE86);

                const menu = new StringSelectMenuBuilder()
                    .setCustomId('admin_main_menu')
                    .setPlaceholder('... اختر الخيار المطلوب لإعداده')
                    .addOptions([
                        { label: 'إعداد نظام تسجيل الدوام والساعات', description: 'تحديد القناة ونشر أزرار الوقت والتقارير التلقائية', value: 'opt_setup_work_timer', emoji: '⏱️' },
                        { label: 'إعداد نظام التقديمات (Applications)', description: 'إعداد Dev App, Staff App أو Interview App والأسئلة', value: 'opt_setup_apps', emoji: '📝' },
                        { label: 'تفعيل إكتيف صوتي 24/7 (Voice Channel)', description: 'دخول البوت لروم صوتي للبقاء متصلاً دائماً', value: 'opt_setup_voice_247', emoji: '🔊' },
                        { label: 'إعداد Waiting for Interview / Help', description: 'تحديد قنوات الانتظار ورتب الإشعار', value: 'opt_setup_waiting', emoji: '⏳' }
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

            if (val === 'opt_setup_work_timer') {
                const modal = new ModalBuilder().setCustomId('modal_setup_work_chan').setTitle('إعداد قناة الدوام والتقارير');
                const chan = new TextInputBuilder().setCustomId('work_post_chan').setLabel('آيدي القناة لنشر أزرار الدوام والتقارير').setStyle(TextInputStyle.Short).setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(chan));
                return await interaction.showModal(modal);
            }

            if (val === 'opt_setup_apps') {
                const embed = new EmbedBuilder()
                    .setTitle('📝 اختر نوع التقديم (Application Type)')
                    .setDescription('اختر نوع التقديم لتحديد القناة والأسئلة الخاصة به:')
                    .setColor(0x3498DB);

                const appMenu = new StringSelectMenuBuilder()
                    .setCustomId('select_app_config_type')
                    .setPlaceholder('... اختر نوع التقديم')
                    .addOptions([
                        { label: 'Developer Application', description: 'إعداد تقديم المطورين (Dev App)', value: 'app_dev', emoji: '💻' },
                        { label: 'Staff Application', description: 'إعداد تقديم طاقم الستاف (Staff App)', value: 'app_staff', emoji: '🛡️' },
                        { label: 'Interview Application', description: 'إعداد تقديم المقابلات (Interview App)', value: 'app_interview', emoji: '🎙️' }
                    ]);

                return await interaction.reply({ embeds: [embed], components: [new ActionRowBuilder().addComponents(appMenu)], ephemeral: true });
            }

            if (val === 'opt_setup_voice_247') {
                const modal = new ModalBuilder().setCustomId('modal_setup_voice_247').setTitle('تفعيل روم صوتي 24/7');
                const vChan = new TextInputBuilder().setCustomId('voice_chan_id').setLabel('آيدي القناة الصوتية (Voice Channel ID)').setStyle(TextInputStyle.Short).setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(vChan));
                return await interaction.showModal(modal);
            }

            if (val === 'opt_setup_waiting') {
                const modal = new ModalBuilder().setCustomId('modal_setup_waiting').setTitle('إعداد قنوات الانتظار');
                const intChan = new TextInputBuilder().setCustomId('w_int_chan').setLabel('آيدي قناة Waiting Interview').setStyle(TextInputStyle.Short).setRequired(false);
                const helpChan = new TextInputBuilder().setCustomId('w_help_chan').setLabel('آيدي قناة Waiting Help').setStyle(TextInputStyle.Short).setRequired(false);
                modal.addComponents(new ActionRowBuilder().addComponents(intChan), new ActionRowBuilder().addComponents(helpChan));
                return await interaction.showModal(modal);
            }
        }

        if (interaction.isStringSelectMenu() && interaction.customId === 'select_app_config_type') {
            const chosenType = interaction.values[0];
            
            let titleText = 'إعداد تقديم المطورين (Dev App)';
            if (chosenType === 'app_staff') titleText = 'إعداد تقديم الستاف (Staff App)';
            if (chosenType === 'app_interview') titleText = 'إعداد تقديم الإنترفيو (Interview App)';

            const modal = new ModalBuilder().setCustomId(`modal_config_app_${chosenType}`).setTitle(titleText);
            const postChan = new TextInputBuilder().setCustomId('post_chan_id').setLabel('آيدي قناة نشر أزرار التقديم').setStyle(TextInputStyle.Short).setRequired(true);
            const recvChan = new TextInputBuilder().setCustomId('recv_chan_id').setLabel('آيدي القناة المستقبلة للإجابات').setStyle(TextInputStyle.Short).setRequired(true);
            const questions = new TextInputBuilder().setCustomId('questions_list').setLabel('اكتب الأسئلة (فصل بين كل سؤال بـ ,)').setStyle(TextInputStyle.Paragraph).setRequired(true);

            modal.addComponents(
                new ActionRowBuilder().addComponents(postChan),
                new ActionRowBuilder().addComponents(recvChan),
                new ActionRowBuilder().addComponents(questions)
            );

            return await interaction.showModal(modal);
        }

        if (interaction.isButton() && interaction.customId.startsWith('start_app_btn_')) {
            const appType = interaction.customId.replace('start_app_btn_', '');
            const appData = db.settings.apps[appType];

            if (!appData || !appData.questions || appData.questions.length === 0) {
                return await interaction.reply({ content: '❌ لم يتم إعداد أسئلة هذا التقديم بعد!', ephemeral: true });
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

            await interaction.reply({ content: '📥 **تم بدء التقديم!** تم إرسال السؤال الأول لك في الرسائل الخاصة (DM).', ephemeral: true });

            try {
                const dm = await interaction.user.createDM();
                await dm.send(`مرحباً بك في تقديم **${appType.toUpperCase()}**!\n\n❓ **السؤال (1/${appData.questions.length}):** ${appData.questions[0]}`);
            } catch (e) {
                await interaction.followUp({ content: '❌ تعذر إرسال رسالة لك بالخاص، يرجى فتح الخاص في إعدادات الأمان.', ephemeral: true });
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
                        .setDescription('اضغط على **🟢 بدء وقت الدوام** لبدء احتساب وقتك تلقائياً، وعند انتهائك اضغط على **🔴 إيقاف الدوام** لحفظ الساعات.\n\n📅 **ملاحظة:** يتم إرسال التقرير الأسبوعي والشهري التلقائي في هذه القناة.')
                        .setColor(0xF39C12);

                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('btn_start_work').setLabel('🟢 بدء وقت الدوام').setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId('btn_stop_work').setLabel('🔴 إيقاف الدوام').setStyle(ButtonStyle.Danger)
                    );

                    await channel.send({ embeds: [embed], components: [row] });
                }

                return await interaction.editReply({ content: `✅ **تم نشر زر الدوام وإعادة توجيه التقارير الأسبوعية والشهري لهذه القناة!** (<#${chanId}>)` });
            }

            if (interaction.customId.startsWith('modal_config_app_')) {
                const appType = interaction.customId.replace('modal_config_app_', '');
                const postChanId = interaction.fields.getTextInputValue('post_chan_id');
                const recvChanId = interaction.fields.getTextInputValue('recv_chan_id');
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
                    let typeName = 'المطورين (Dev Application)';
                    if (appType === 'app_staff') typeName = 'طاقم الستاف (Staff Application)';
                    if (appType === 'app_interview') typeName = 'المقابلات (Interview Application)';

                    const embed = new EmbedBuilder()
                        .setTitle(`📝 تقديم ${typeName}`)
                        .setDescription('اضغط على الزر بالأسفل للبدء بالتقديم والإجابة على الأسئلة عبر الرسائل الخاصة (DM):')
                        .setColor(0x00FF7F);

                    const btn = new ButtonBuilder()
                        .setCustomId(`start_app_btn_${appType}`)
                        .setLabel(`🚀 بدء تقديم ${appType.replace('app_', '').toUpperCase()}`)
                        .setStyle(ButtonStyle.Success);

                    await postChannel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(btn)] });
                }

                return await interaction.editReply({ content: `✅ **تم إعداد ونشر تقديم ${appType.toUpperCase()} بنجاح!**` });
            }

            if (interaction.customId === 'modal_setup_voice_247') {
                const vChanId = interaction.fields.getTextInputValue('voice_chan_id');
                db.settings.voice247 = vChanId;
                saveDB();

                try {
                    joinVoiceChannel({
                        channelId: vChanId,
                        guildId: interaction.guild.id,
                        adapterCreator: interaction.guild.voiceAdapterCreator,
                        selfDeaf: true
                    });
                    return await interaction.editReply({ content: `✅ **تم تفعيل وضع 24/7 بنجاح!** دخل البوت في الروم الصوتي <#${vChanId}> ولن يخرج منه.` });
                } catch (e) {
                    return await interaction.editReply({ content: `❌ تعذر الدخول للروم الصوتي، تأكد من صحة الآيدي وصلاحيات البوت.` });
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
            await message.reply('🎉 **تم استلام جميع إجاباتك بنجاح!** تم إرسال تقديمك إلى القناة المخصصة للمراجعة.');

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
