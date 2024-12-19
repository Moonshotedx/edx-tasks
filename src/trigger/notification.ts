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
    UserEmail: z.string(),
    UserName: z.string(),
    JobTitle: z.string(),
    CompanyName: z.string(),
    PhoneNumber: z.string(),
    // website:z.string(),
  }),

run: async (payload) => {
    const { UserEmail, UserName, JobTitle, CompanyName, PhoneNumber } = payload;

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
            address: UserEmail,
            name: UserName,
          },
        },
      ],
      merge_info: {
        COMPANY: CompanyName,
        name: UserName,
        job_title: JobTitle,
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
      whatsappNumber: PhoneNumber,
    });
    const watiPayload = {
      template_name: "job_application_notification",
      broadcast_name: "job_application_notification_171220241949",
      parameters: [
        { name: "name", value: UserName },
        {name:"job_title",value:JobTitle},
        {name:"company", value:CompanyName},
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
    UserEmail: z.string(),      
    UserName: z.string(),        
    JobTitle: z.string(),       
    CompanyName: z.string(),     
    Decision: z.string(),       
    StageTitle: z.string().optional(), 
    Feedback: z.string().optional(),
    PhoneNumber:z.string(),  
  }),

  run: async (payload) => {
    logger.log("Received Payload:", { payload });
    const { UserEmail, UserName, JobTitle, CompanyName, Decision, StageTitle, Feedback, PhoneNumber } = payload;

    // Initialize ZeptoMail client
    const sendMailClient = new SendMailClient({
      token: process.env.ZEPTOMAIL_API_KEY,
      url: process.env.ZEPTOMAIL_URL, 
    });

    const templateKey =
    Decision === "accepted"
        ? "2518b.1f3f9645fe91eda6.k1.15977ad0-bb88-11ef-aefe-52540038fbba.193ce979afd"
        : "2518b.1f3f9645fe91eda6.k1.b05ad071-bb89-11ef-aefe-52540038fbba.193cea21ef4";

    const templateAlias =
    Decision === "accepted" ? "applicationaccepted" : "applicationrejected";

    const mergeInfo =
    Decision === "accepted"
        ? {
            feedback: Feedback || "All the best!",
            student_name: UserName || "Candidate",
            stage: StageTitle || "Next round",
            company_name: CompanyName,
            job_title: JobTitle,
          }
        : {
            feedback: Feedback || "All the best for future!",
            student_name: UserName || "Candidate",
            company_name: CompanyName,
            job_title: JobTitle,
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
            address: UserEmail,
            name: UserName,
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
    const watiTemplateName = Decision === "accepted" ? "application_accepted" : "application_rejected";

    const watiPayload =
    Decision === "accepted"
        ? {
            template_name: watiTemplateName,
            broadcast_name: watiTemplateName,
            parameters: [
              { name: "student_name", value: UserName },
              { name: "company_name", value: CompanyName },
              { name: "job_title", value: JobTitle },
              { name: "stage", value: StageTitle|| "Next round" },
              { name: "navigate", value: "listing" },
            ],
          }
        : {
            template_name: watiTemplateName,
            broadcast_name: watiTemplateName,
            parameters: [
              { name: "student_name", value: UserName },
              { name: "company_name", value: CompanyName },
              { name: "job_title", value: JobTitle },
              { name: "navigate", value: "jobs" },
            ],
          };

    const queryParams = new URLSearchParams({
      whatsappNumber: PhoneNumber,
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
    JobType: z.string(),           
    Website: z.string().url(),    
    CompanyName: z.string(),       
    ApplicationDeadline: z.string(), 
    Salary: z.string(),            
    InstituteName: z.string(),     
    JobTitle: z.string(),          
    JobLocation: z.string(),       
    InstituteEmail: z.string().email(),
  }),

  run: async (payload) => {
    const {
      JobType,
      Website,
      CompanyName,
      ApplicationDeadline,
      Salary,
      InstituteName,
      JobTitle,
      JobLocation,
      InstituteEmail,
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
            address: InstituteEmail,  
            name: InstituteName,      
          },
        },
      ],
      merge_info: {
        JobType,            
        Website,            
        CompanyName,        
        ApplicationDeadline, 
        Salary,              
        InstituteName,      
        JobTitle,         
        JobLocation,       
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
