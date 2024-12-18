import { logger, schemaTask } from "@trigger.dev/sdk/v3";
import { z } from "zod";
import { SendMailClient } from "zeptomail";

///////////////////////////////////////////apply job and send mail///////////////////////////////////////////////////////////////
export const applyJobAndSendEmail = schemaTask({
  id: "apply-job-and-send-email",
  retry: {
    maxAttempts: 2,
    factor: 1.5,
    randomize: true,
  },
  schema: z.object({
    userEmail: z.string(),
    userName: z.string(),
    jobTitle: z.string(),
    companyName: z.string(),
    phoneNumber: z.string(),
    // website:z.string(),
  }),

run: async (payload) => {
    const { userEmail, userName, jobTitle, companyName, phoneNumber } = payload;

    const sendMailClient = new SendMailClient({
      token: process.env.ZEPTOMAIL_API_KEY,
      url: process.env.ZEPTOMAIL_URL,
    });

    await sendMailClient.sendMailWithTemplate({
      template_key: "2518b.1f3f9645fe91eda6.k1.338f67b0-bb87-11ef-aefe-52540038fbba.193ce91d1ab",
      template_alias: "jobapplication",
      from: {
        address: "no-reply@xcelerator.co.in",
        name: "Xcelerator",
      },
      to: [
        {
          email_address: {
            address: userEmail,
            name: userName,
          },
        },
      ],
      merge_info: {
        COMPANY: companyName,
        name: userName,
        job_title: jobTitle,
      },
      reply_to: [
        {
          address: "support@xcelerator.co.in",
          name: "Support Team",
        },
      ],
    });

    logger.log("Email sent successfully via ZeptoMail");
    // Send WhatsApp message
    const watiBaseUrl = process.env.WATI_API_URL; 
    const watiUrl = `${watiBaseUrl}/sendTemplateMessage`;
    const watiToken = process.env.WATI_API_KEY;
    const queryParams = new URLSearchParams({
      whatsappNumber: phoneNumber,
    });
    const watiPayload = {
      template_name: "job_application_notification",
      broadcast_name: "job_application_notification_171220241949",
      parameters: [
        { name: "name", value: userName },
        {name:"job_title",value:jobTitle},
        {name:"company", value:companyName},
        {name:"navigate", value:"listing"}
      ],
    };

    console.log(watiPayload);

    const watiResponse = await fetch(`${watiUrl}?${queryParams.toString()}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${watiToken}`,
      },
      body: JSON.stringify(watiPayload),
    });

    if (!watiResponse.ok) {
      console.log("not okay")
      const errorDetails = await watiResponse.json();
      throw new Error(`WATI API Error: ${JSON.stringify(errorDetails)}`);
    }

    logger.log("WhatsApp message sent successfully via WATI");

    return { message: "Notifications sent successfully" };
  },
});

//////////////////////////////////////////////////Sending Decision notification/////////////////////////////////////////////////////////////////

export const sendDecisionMail = schemaTask({
  id: "send-decision-mail",
  retry: {
    maxAttempts: 3,
    factor: 1.5,
    randomize: true,
  },
  schema: z.object({
    userEmail: z.string(),      
    userName: z.string(),        
    jobTitle: z.string(),       
    companyName: z.string(),     
    decision: z.string(),       
    stageTitle: z.string().optional(), 
    feedback: z.string().optional(),
    phoneNumber:z.string(),  
  }),

  run: async (payload) => {
    logger.log("Received Payload:", { payload });
    const { userEmail, userName, jobTitle, companyName, decision, stageTitle, feedback, phoneNumber } = payload;

    // Initialize ZeptoMail client
    const sendMailClient = new SendMailClient({
      token: process.env.ZEPTOMAIL_API_KEY,
      url: process.env.ZEPTOMAIL_URL, 
    });

    const templateKey =
      decision === "accepted"
        ? "2518b.1f3f9645fe91eda6.k1.15977ad0-bb88-11ef-aefe-52540038fbba.193ce979afd"
        : "2518b.1f3f9645fe91eda6.k1.b05ad071-bb89-11ef-aefe-52540038fbba.193cea21ef4";

    const templateAlias =
      decision === "accepted" ? "applicationaccepted" : "applicationrejected";

    const mergeInfo =
      decision === "accepted"
        ? {
            feedback: feedback || "All the best!",
            student_name: userName || "Candidate",
            stage: stageTitle || "Next round",
            company_name: companyName,
            job_title: jobTitle,
          }
        : {
            feedback: feedback || "All the best for future!",
            student_name: userName || "Candidate",
            company_name: companyName,
            job_title: jobTitle,
          };

    // Send email with the selected template
    await sendMailClient.sendMailWithTemplate({
      template_key: templateKey,
      template_alias: templateAlias,
      from: {
        address: "no-reply@xcelerator.co.in",
        name: "Xcelerator",
      },
      to: [
        {
          email_address: {
            address: userEmail,
            name: userName,
          },
        },
      ],
      merge_info: mergeInfo,
      reply_to: [
        {
          address: "support@xcelerator.co.in",
          name: "Support Team",
        },
      ],
    });

    logger.log("Email sent successfully via ZeptoMail");

    // watsapp message
    const watiUrl = process.env.WATI_API_URL;
    const watiTemplateName = decision === "accepted" ? "application_accepted" : "application_rejected";

    const watiPayload =
      decision === "accepted"
        ? {
            template_name: watiTemplateName,
            broadcast_name: watiTemplateName,
            parameters: [
              { name: "student_name", value: userName },
              { name: "company_name", value: companyName },
              { name: "job_title", value: jobTitle },
              { name: "stage", value: stageTitle || "Next round" },
              { name: "navigate", value: "listing" },
            ],
          }
        : {
            template_name: watiTemplateName,
            broadcast_name: watiTemplateName,
            parameters: [
              { name: "student_name", value: userName },
              { name: "company_name", value: companyName },
              { name: "job_title", value: jobTitle },
              { name: "navigate", value: "jobs" },
            ],
          };

    const queryParams = new URLSearchParams({
      whatsappNumber: phoneNumber,
    });

    const watiResponse = await fetch(`${watiUrl}/sendTemplateMessage?${queryParams.toString()}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json-patch+json",
        Authorization: `Bearer ${process.env.WATI_API_KEY}`,
      },
      body: JSON.stringify(watiPayload),
    });

    const watiResponseText = await watiResponse.text();
    const watiResponseBody = watiResponseText ? JSON.parse(watiResponseText) : null;

    if (!watiResponse.ok) {
      logger.error("Failed to send WhatsApp message via WATI:", watiResponseBody || watiResponseText);
      throw new Error(`WATI API Error: ${watiResponse.statusText}`);
    }

    logger.log("WhatsApp message sent successfully via WATI:", watiResponseBody);

    return { message: "Email and WhatsApp message sent successfully" };
  },
});

/////////////////////////////////////////////////////////send job notification////////////////////////////////////////////////////////
export const sendJobEmail = schemaTask({
  id: "send-job-email-facilitator",
  retry: {
    maxAttempts: 3,
    factor: 1.5,
    randomize: true,
  },
  schema: z.object({
    job_type: z.string(),           
    website: z.string().url(),    
    company_name: z.string(),       
    application_deadline: z.string(), 
    salary: z.string(),            
    institute_name: z.string(),     
    job_title: z.string(),          
    job_location: z.string(),       
    institute_email: z.string().email(),
  }),

  run: async (payload) => {
    const {
      job_type,
      website,
      company_name,
      application_deadline,
      salary,
      institute_name,
      job_title,
      job_location,
      institute_email,
    } = payload;

    // Initialize ZeptoMail client
    const sendMailClient = new SendMailClient({
      token: process.env.ZEPTOMAIL_API_KEY, 
      url: process.env.ZEPTOMAIL_URL,
    });

    // Send email with the payload
    await sendMailClient.sendMailWithTemplate({
      template_key: "2518b.1f3f9645fe91eda6.k1.ef858281-bb8a-11ef-aefe-52540038fbba.193ceaa4a9f", // Replace with your template key
      template_alias: "jobposting",      // Replace with your template alias
      from: {
        address: "no-reply@xcelerator.co.in", 
        name: "Xcelerator",             
      },
      to: [
        {
          email_address: {
            address: institute_email,  
            name: institute_name,      
          },
        },
      ],
      merge_info: {
        job_type,            
        website,            
        company_name,        
        application_deadline, 
        salary,              
        institute_name,      
        job_title,         
        job_location,       
      },
      reply_to: [
        {
          address: "support@xcelerator.co.in", // Support email
          name: "Support Team",
        },
      ],
    });

    console.log("Email sent successfully via ZeptoMail");
    return { message: "Email sent successfully" };
  },
});
