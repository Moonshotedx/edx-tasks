import { logger, schemaTask } from "@trigger.dev/sdk/v3";
import { z } from "zod";
import { SendMailClient } from "zeptomail";

export const applyJobAndSendEmail = schemaTask({
  id: "apply-job-and-send-email",
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
  }),

  run: async (payload) => {
    try {

      // Extract data from the payload
      const { userEmail, userName, jobTitle, companyName } = payload;

      // Initialize ZeptoMail client
      const sendMailClient = new SendMailClient({
        token: "Zoho-enczapikey PHtE6r0LEeq/izEq8xZU5/PtFcCnZN56/b9gfgJH4t0UCqdXFk0B/4x+xzCzrh8qUvBLR/PIwd08ubObs7+GJmfuZD0dX2qyqK3sx/VYSPOZsbq6x00ZsF8ZcEzdUofvcNJj0SzVs93YNA==", // Replace with your ZeptoMail API key
        url: "https://api.zeptomail.in/",
      });

      // Send email with the expected payload format
      await sendMailClient.sendMailWithTemplate({
        template_key: "2518b.1f3f9645fe91eda6.k1.338f67b0-bb87-11ef-aefe-52540038fbba.193ce91d1ab", // Replace with your template key
        template_alias: "jobapplication", // Replace with your template alias
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
      return { message: "Email sent successfully" };

    } catch (error) {
      logger.error("Error in applyJobAndSendEmail:");
      throw error;
    }
  },
});

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
  }),

  run: async (payload) => {
    try {
  
      logger.log("Received Payload:", { payload });
      const { userEmail, userName, jobTitle, companyName, decision, stageTitle, feedback } = payload;

      // Initialize ZeptoMail client
      const sendMailClient = new SendMailClient({
        token: "Zoho-enczapikey PHtE6r0LEeq/izEq8xZU5/PtFcCnZN56/b9gfgJH4t0UCqdXFk0B/4x+xzCzrh8qUvBLR/PIwd08ubObs7+GJmfuZD0dX2qyqK3sx/VYSPOZsbq6x00ZsF8ZcEzdUofvcNJj0SzVs93YNA==", // Replace with your ZeptoMail API key
        url: "https://api.zeptomail.in/", 
      });

      
      const templateKey = decision === "accepted"
        ? "2518b.1f3f9645fe91eda6.k1.15977ad0-bb88-11ef-aefe-52540038fbba.193ce979afd" // Replace with your accepted decision template key
        : "2518b.1f3f9645fe91eda6.k1.b05ad071-bb89-11ef-aefe-52540038fbba.193cea21ef4"; // Replace with your rejected decision template key

      const templateAlias = decision === "accepted"
        ? "applicationaccepted" // Replace with your accepted decision template alias
        : "applicationrejected"; // Replace with your rejected decision template alias

      // Prepare merge info dynamically based on decision
      const mergeInfo = decision === "accepted"
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
              address: userEmail, // Recipient email
              name: userName,     // Recipient name
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
      return { message: "Email sent successfully" };

    } catch (error) {
      logger.error("Error in sendDecisionMail:", { error });
      throw error;
    }
  },
});

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
    try {
      
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
        token: "Zoho-enczapikey PHtE6r0LEeq/izEq8xZU5/PtFcCnZN56/b9gfgJH4t0UCqdXFk0B/4x+xzCzrh8qUvBLR/PIwd08ubObs7+GJmfuZD0dX2qyqK3sx/VYSPOZsbq6x00ZsF8ZcEzdUofvcNJj0SzVs93YNA==", // Replace with your ZeptoMail API key
        url: "https://api.zeptomail.in/",     // ZeptoMail base URL
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
    } catch (error) {
      console.error("Error in sendJobEmail:", error);
      throw error;
    }
  },
});
