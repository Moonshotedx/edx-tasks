import { logger, schemaTask } from "@trigger.dev/sdk/v3";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { z } from "zod";
import path from "path";
import fs from "fs";
import axios from "axios";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";

dotenv.config(); // Load environment variables

// R2 Config
const R2_ENDPOINT=process.env.R2_ENDPOINT;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const BUCKET_NAME = "xcelerator-applications";
const PUBLIC_DOMAIN="https://r2-applications.xcelerator.co.in";

// Initialize S3 Client
if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
  throw new Error("R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY must be defined");
}

const s3 = new S3Client({
  region: "auto",
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

// schema for the payload with null handling
const userProfileSchema = z.object({

  user_id: z.string().nullish().transform(val => val || ""),
  email: z.string().nullish().transform(val => val || ""),
  username: z.string().nullish().transform(val => val || ""),
  first_name: z.string().nullish().transform(val => val || ""),
  last_name: z.string().nullish().transform(val => val || ""),
  gender: z.string().nullish().transform(val => val || ""),
  date_of_birth: z.string().nullish().transform(val => val || ""),
  phone_number: z.string().nullish().transform(val => val || ""),
  user_type: z.string().nullish().transform(val => val || ""),
  meta_data: z.object({
    usn: z.string().nullish().transform(val => val || ""),
    batch: z.string().nullish().transform(val => val || ""),
    title: z.string().nullish().transform(val => val || ""),
    status: z.string().nullish().transform(val => val || ""),
    location: z.string().nullish().transform(val => val || ""),
    institute: z.string().nullish().transform(val => val || ""),
    department: z.string().nullish().transform(val => val || ""),
    description: z.string().nullish().transform(val => val || ""),
    social_links: z.object({
      github: z.string().nullish().transform(val => val || ""),
      twitter: z.string().nullish().transform(val => val || ""),
      website: z.string().nullish().transform(val => val || ""),
      linkedin: z.string().nullish().transform(val => val || ""),
    }).nullish().transform(val => val || {
      github: "",
      twitter: "",
      website: "",
      linkedin: ""
    }),
    current_semester: z.string().nullish().transform(val => val || ""),
    profile_video_url: z.string().nullish().transform(val => val || ""),
    admission_category: z.string().nullish().transform(val => val || ""),
  }).nullish().transform(val => val || {
    usn: "",
    batch: "",
    title: "",
    status: "",
    location: "",
    institute: "",
    department: "",
    description: "",
    social_links: {
      github: "",
      twitter: "",
      website: "",
      linkedin: ""
    },
    current_semester: "",
    profile_video_url: "",
    admission_category: ""
  }),
  experiences: z.object({
    award: z.array(z.any()).nullish().transform(val => val || []),
    certification: z.array(z.any()).nullish().transform(val => val || []),
    education: z.array(z.any()).nullish().transform(val => val || []),
    placement: z.array(z.any()).nullish().transform(val => val || []),
    project: z.array(z.any()).nullish().transform(val => val || []),
    publication: z.array(z.any()).nullish().transform(val => val || []),
    talk: z.array(z.any()).nullish().transform(val => val || []),
    work: z.array(z.any()).nullish().transform(val => val || []),
  }).nullish().transform(val => val || {
    award: [],
    certification: [],
    education: [],
    placement: [],
    project: [],
    publication: [],
    talk: [],
    work: []
  }),
  attributes: z.object({
    aspiring_companies: z.array(z.any()).nullish().transform(val => val || []),
    aspiring_job_roles: z.array(z.any()).nullish().transform(val => val || []),
    skill: z.array(z.any()).nullish().transform(val => val || []),
    skills: z.array(z.any()).nullish().transform(val => val || []),
  }).nullish().transform(val => val || {
    aspiring_companies: [],
    aspiring_job_roles: [],
    skill: [],
    skills: []
  }),
  stats_charts: z.array(z.any()).nullish().transform(val => val || []),
  job_id: z.number(),

});

// Define color themes similar to the Template3
const COLOR_THEMES = {
  modern: {
    primary: "#05126e",
    secondary: "#0e1217",
    accent: "#bec7d4",
    divider: "#7690b5",
    background: "#ffffff", // Changed from #d9c3c3 to white for better printing
  },
};

const FONT_MAPPING = {
  default: {
    normal: StandardFonts.TimesRoman,
    bold: StandardFonts.TimesRomanBold,
    italic: StandardFonts.TimesRomanItalic,
  },
};

// Helper function to format dates
function formatDate(dateString: string): string {
  if (!dateString || dateString === "0001-01-01T00:00:00Z") return "N/A";

  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
    });
  } catch (e) {
    return "N/A";
  }
}

// function to sanitize text for PDF rendering
function sanitizeText(text: string): string {
  if (!text) return "";

  // newlines with spaces
  text = text.replace(/\n/g, " ");

  // multiple spaces with a single space
  text = text.replace(/\s+/g, " ");

  // Remove any other problematic characters for PDF rendering
  text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");

  return text.trim();
}

async function fetchImageAsBase64(url: string): Promise<string> {
  try {
    const response = await axios.get(url, {
      responseType: "arraybuffer",
    });

    // binary data to base64
    return Buffer.from(response.data, "binary").toString("base64");
  } catch (error) {
    logger.error("Error fetching image", { url, error });
    throw error;
  }
}

export const generateProfileResume = schemaTask({
  id: "generate-profile-resume",
  retry: {
    maxAttempts: 3,
    factor: 1.5,
    randomize: true,
  },
  maxDuration: 300,
  schema: userProfileSchema,

  run: async (payload) => {
    logger.log("Resume generation task started", { userId: payload.user_id });

    try {
      // Use the modern color theme
      const COLORS = COLOR_THEMES.modern;
      const FONTS = FONT_MAPPING.default;

      // Generate the PDF document using pdf-lib
      const pdfDoc = await PDFDocument.create();
      const timesRoman = await pdfDoc.embedFont(FONTS.normal);
      const timesRomanBold = await pdfDoc.embedFont(FONTS.bold);
      const timesRomanItalic = await pdfDoc.embedFont(FONTS.italic);

      // Create the first page
      const pageSize: [number, number] = [595.28, 841.89]; // A4 size
      let page = pdfDoc.addPage(pageSize);
      const { width, height } = page.getSize();

      // Set initial cursor position and constants
      let currentY = height - 40;
      const margin = 40;
      const contentWidth = width - 2 * margin;
      const textSize = 10;
      const headingSize = 16;
      const subheadingSize = 14;
      const lineHeight = 16;
      const sectionSpacing = 30;
      const itemSpacing = 12;

      const drawText = (
        text: string,
        x: number,
        y: number,
        options?: {
          size?: number;
          font?: any;
          color?: [number, number, number];
          maxWidth?: number;
          align?: string;
        }
      ) => {
        // Sanitize text to prevent encoding errors
        text = sanitizeText(text);

        // Check if we need a new page
        if (y < margin) {
          page = pdfDoc.addPage(pageSize);
          y = height - margin;
        }

        if (options?.maxWidth && text.length > 0) {
          const words = text.split(" ");
          let line = "";
          let newY = y;

          for (const word of words) {
            const testLine = line + (line ? " " : "") + word;

            if (testLine.trim() === "") continue;

            try {
              const textWidth = (options?.font || timesRoman).widthOfTextAtSize(
                testLine,
                options.size || textSize
              );

              if (textWidth > options.maxWidth) {
                if (line.trim() !== "") {
                  // Check if we need a new page
                  if (newY < margin) {
                    page = pdfDoc.addPage(pageSize);
                    newY = height - margin;
                  }

                  let xPos = x;
                  if (options?.align === "center") {
                    const lineWidth = (
                      options?.font || timesRoman
                    ).widthOfTextAtSize(line, options?.size || textSize);
                    xPos = x + (options.maxWidth - lineWidth) / 2;
                  } else if (options?.align === "right") {
                    const lineWidth = (
                      options?.font || timesRoman
                    ).widthOfTextAtSize(line, options?.size || textSize);
                    xPos = x + options.maxWidth - lineWidth;
                  }

                  page.drawText(line, {
                    x: xPos,
                    y: newY,
                    size: options?.size || textSize,
                    font: options?.font || timesRoman,
                    color: options?.color
                      ? rgb(
                          options.color[0],
                          options.color[1],
                          options.color[2]
                        )
                      : rgb(0, 0, 0),
                  });

                  newY = newY - (options?.size || textSize) - 5;
                }
                line = word;
              } else {
                line = testLine;
              }
            } catch (error) {
              logger.warn("Error measuring text width", {
                text: testLine,
                error: error,
              });
              continue;
            }
          }

          // Draw remaining text
          if (line.trim() !== "") {
            if (newY < margin) {
              page = pdfDoc.addPage(pageSize);
              newY = height - margin;
            }

            let xPos = x;
            if (options?.align === "center") {
              const lineWidth = (options?.font || timesRoman).widthOfTextAtSize(
                line,
                options?.size || textSize
              );
              xPos = x + (options.maxWidth - lineWidth) / 2;
            } else if (options?.align === "right") {
              const lineWidth = (options?.font || timesRoman).widthOfTextAtSize(
                line,
                options?.size || textSize
              );
              xPos = x + options.maxWidth - lineWidth;
            }

            page.drawText(line, {
              x: xPos,
              y: newY,
              size: options?.size || textSize,
              font: options?.font || timesRoman,
              color: options?.color
                ? rgb(options.color[0], options.color[1], options.color[2])
                : rgb(0, 0, 0),
            });

            return newY - (options?.size || textSize) - 5;
          }
          return newY;
        } else if (text.trim() !== "") {
          try {
            let xPos = x;
            if (options?.align === "center" && options?.maxWidth) {
              const textWidth = (options?.font || timesRoman).widthOfTextAtSize(
                text,
                options?.size || textSize
              );
              xPos = x + (options.maxWidth - textWidth) / 2;
            } else if (options?.align === "right" && options?.maxWidth) {
              const textWidth = (options?.font || timesRoman).widthOfTextAtSize(
                text,
                options?.size || textSize
              );
              xPos = x + options.maxWidth - textWidth;
            }

            page.drawText(text, {
              x: xPos,
              y,
              size: options?.size || textSize,
              font: options?.font || timesRoman,
              color: options?.color
                ? rgb(options.color[0], options.color[1], options.color[2])
                : rgb(0, 0, 0),
            });
          } catch (error) {
            logger.warn("Error drawing text", { text, error: error });
            for (let i = 0; i < text.length; i++) {
              try {
                page.drawText(text[i], {
                  x: x + i * (options?.size || textSize) * 0.6,
                  y,
                  size: options?.size || textSize,
                  font: options?.font || timesRoman,
                  color: options?.color
                    ? rgb(options.color[0], options.color[1], options.color[2])
                    : rgb(0, 0, 0),
                });
              } catch (charError) {
                // Skip this character if there's an error
                continue;
              }
            }
          }
          return y - (options?.size || textSize) - 5;
        }
        return y;
      };

      const drawSectionHeading = (text: string, y: number) => {
        if (y < margin + headingSize + 20) {
          page = pdfDoc.addPage(pageSize);
          y = height - margin;
        }

        let newY = drawText(text, margin, y, {
          size: headingSize,
          font: timesRomanBold,
          color: [
            parseInt(COLORS.primary.slice(1, 3), 16) / 255,
            parseInt(COLORS.primary.slice(3, 5), 16) / 255,
            parseInt(COLORS.primary.slice(5, 7), 16) / 255,
          ],
        });

        newY -= 5;

        page.drawLine({
          start: { x: margin, y: newY + 5 },
          end: { x: width - margin, y: newY + 5 },
          thickness: 1,
          color: rgb(
            parseInt(COLORS.divider.slice(1, 3), 16) / 255,
            parseInt(COLORS.divider.slice(3, 5), 16) / 255,
            parseInt(COLORS.divider.slice(5, 7), 16) / 255
          ),
        });

        return newY - 10;
      };

      currentY = drawText(payload.username, margin, currentY, {
        size: 24,
        font: timesRomanBold,
        color: [
          parseInt(COLORS.primary.slice(1, 3), 16) / 255,
          parseInt(COLORS.primary.slice(3, 5), 16) / 255,
          parseInt(COLORS.primary.slice(5, 7), 16) / 255,
        ],
        maxWidth: contentWidth,
        align: "center",
      });
      currentY -= 5;

      let contactInfo = "";
      if (payload.email) contactInfo += payload.email;
      if (payload.phone_number) {
        if (contactInfo) contactInfo += " | ";
        contactInfo += payload.phone_number;
      }

      currentY = drawText(contactInfo, margin, currentY, {
        maxWidth: contentWidth,
        align: "center",
      });
      currentY -= 10;

      const { social_links } = payload.meta_data;
      let socialText = "";

      if (social_links.linkedin) socialText += "LinkedIn";
      if (social_links.github) {
        if (socialText) socialText += " | ";
        socialText += "GitHub";
      }
      if (social_links.twitter) {
        if (socialText) socialText += " | ";
        socialText += "Twitter";
      }
      if (social_links.website) {
        if (socialText) socialText += " | ";
        socialText += "Website";
      }

      if (socialText) {
        currentY = drawText(socialText, margin, currentY, {
          maxWidth: contentWidth,
          align: "center",
          color: [
            parseInt(COLORS.primary.slice(1, 3), 16) / 255,
            parseInt(COLORS.primary.slice(3, 5), 16) / 255,
            parseInt(COLORS.primary.slice(5, 7), 16) / 255,
          ],
        });
        currentY -= 10;
      }

      if (
        payload.meta_data.description &&
        sanitizeText(payload.meta_data.description) !== ""
      ) {
        currentY = drawText(payload.meta_data.description, margin, currentY, {
          maxWidth: contentWidth,
          align: "center",
        });
        currentY -= sectionSpacing;
      }

      // Education section
      if (
        payload.experiences.education &&
        payload.experiences.education.length > 0
      ) {
        currentY = drawSectionHeading("EDUCATION", currentY);

        // Education entries
        for (const edu of payload.experiences.education) {
          if (currentY < margin + 60) {
            page = pdfDoc.addPage(pageSize);
            currentY = height - margin;
          }

          if (edu.title) {
            const titleY = currentY;
            currentY = drawText(edu.title, margin, currentY, {
              font: timesRomanBold,
              size: 11,
              color: [0.176, 0.216, 0.282],
            });

            // Draw date on the right side
            if (edu.start_date) {
              const dateText = `${formatDate(edu.start_date)} - ${
                edu.is_ongoing ? "Present" : formatDate(edu.end_date)
              }`;
              drawText(dateText, margin + contentWidth * 0.7, titleY, {
                font: timesRoman,
                size: 9,
                color: [0.443, 0.502, 0.588],
                maxWidth: contentWidth * 0.3,
                align: "right",
              });
            }
          }

          // Institution with location
          if (edu.organisation) {
            let institutionText = edu.organisation;
            if (edu.location) institutionText += ` | ${edu.location}`;

            currentY = drawText(institutionText, margin + 10, currentY, {
              font: timesRomanItalic,
              size: 10,
              color: [0.29, 0.333, 0.408],
            });
          }

          // Description
          if (edu.description) {
            currentY = drawText(edu.description, margin + 10, currentY, {
              maxWidth: contentWidth - 10,
              color: [0.29, 0.333, 0.408],
            });
          }

          // Add grades if available
          if (edu.grades && edu.grades.length > 0) {
            for (const grade of edu.grades) {
              if (grade.title === "OVERALL") {
                currentY = drawText(
                  `Overall Grade: ${grade.value}`,
                  margin + 10,
                  currentY,
                  {
                    font: timesRomanBold,
                    size: 10,
                    color: [0.173, 0.322, 0.51],
                  }
                );
              }
            }
          }

          currentY -= itemSpacing;
        }

        currentY -= sectionSpacing - itemSpacing;
      }

      // Work Experience section
      if (payload.experiences.work && payload.experiences.work.length > 0) {
        currentY = drawSectionHeading("WORK EXPERIENCE", currentY);

        // Work entries
        for (const work of payload.experiences.work) {
          if (currentY < margin + 60) {
           
            page = pdfDoc.addPage(pageSize);
            currentY = height - margin;
          }

          // Create a row with title on left and dates on right
          if (work.title) {
            const titleY = currentY;
            currentY = drawText(
              `${sanitizeText(work.title)}${
                work.organisation ? ` - ${sanitizeText(work.organisation)}` : ""
              }`,
              margin,
              currentY,
              {
                font: timesRomanBold,
                size: 11,
                color: [0.176, 0.216, 0.282],
              }
            );

            // Draw date on the right side
            if (work.start_date) {
              const dateText = `${formatDate(work.start_date)} - ${
                work.is_ongoing ? "Present" : formatDate(work.end_date)
              }`;
              drawText(dateText, margin + contentWidth * 0.7, titleY, {
                font: timesRoman,
                size: 9,
                color: [0.443, 0.502, 0.588],
                maxWidth: contentWidth * 0.3,
                align: "right",
              });
            }
          }

          // Location
          if (work.location) {
            currentY = drawText(work.location, margin + 10, currentY, {
              font: timesRomanItalic,
              size: 9,
              color: [0.443, 0.502, 0.588],
            });
          }

          // Description
          if (work.description) {
            currentY = drawText(work.description, margin + 10, currentY, {
              maxWidth: contentWidth - 10,
              color: [0.29, 0.333, 0.408],
            });
          }

          currentY -= itemSpacing;
        }

        currentY -= sectionSpacing - itemSpacing;
      }

      // Projects section
      if (
        payload.experiences.project &&
        payload.experiences.project.length > 0
      ) {
        currentY = drawSectionHeading("PROJECTS", currentY);

        // Project entries
        for (const project of payload.experiences.project) {
          if (currentY < margin + 60) {
            page = pdfDoc.addPage(pageSize);
            currentY = height - margin;
          }

          if (project.title) {
            const titleY = currentY;
            currentY = drawText(project.title, margin, currentY, {
              font: timesRomanBold,
              size: 11,
              color: [0.176, 0.216, 0.282],
            });

            if (project.start_date) {
              const dateText = `${formatDate(project.start_date)} - ${
                project.is_ongoing ? "Present" : formatDate(project.end_date)
              }`;
              drawText(dateText, margin + contentWidth * 0.7, titleY, {
                font: timesRoman,
                size: 9,
                color: [0.443, 0.502, 0.588], 
                maxWidth: contentWidth * 0.3,
                align: "right",
              });
            }
          }

          // Organization
          if (project.organisation) {
            currentY = drawText(project.organisation, margin + 10, currentY, {
              font: timesRomanItalic,
              size: 10,
              color: [0.29, 0.333, 0.408],
            });
          }

          // Description
          if (project.description) {
            currentY = drawText(project.description, margin + 10, currentY, {
              maxWidth: contentWidth - 10,
              color: [0.29, 0.333, 0.408],
            });
          }

          currentY -= itemSpacing;
        }

        currentY -= sectionSpacing - itemSpacing;
      }

      if (
        payload.attributes.skills?.length > 0 ||
        payload.attributes.skill?.length > 0
      ) {
        currentY = drawSectionHeading("SKILLS", currentY);

        const allSkills = [
          ...(payload.attributes.skills || []),
          ...(payload.attributes.skill || []),
        ];
        const uniqueSkills = Array.from(
          new Set(allSkills.map((skill) => skill.label))
        )
          .map((label) => allSkills.find((skill) => skill.label === label))
          .filter((skill) => skill && skill.label);

        if (uniqueSkills.length > 0) {
          let currentX = margin;
          const maxWidth = width - margin * 2;
          const badgePadding = 8;
          const badgeMargin = 8;

          for (const skill of uniqueSkills) {
            const skillText = sanitizeText(skill.label);
            if (!skillText) continue;

            const textWidth = timesRoman.widthOfTextAtSize(skillText, 8);
            const badgeWidth = textWidth + badgePadding * 2;

            // Check if we need to move to the next line
            if (currentX + badgeWidth > width - margin) {
              currentX = margin;
              currentY -= 20;
              if (currentY < margin) {
                page = pdfDoc.addPage(pageSize);
                currentY = height - margin;
              }
            }

            // Draw skill badge background
            page.drawRectangle({
              x: currentX,
              y: currentY - 10,
              width: badgeWidth,
              height: 18,
              color: rgb(0.922, 0.957, 1),
              borderColor: rgb(0.867, 0.914, 0.973),
              borderWidth: 0.5,
            });

            // Draw skill text
            page.drawText(skillText, {
              x: currentX + badgePadding,
              y: currentY - 5,
              size: 8,
              font: timesRoman,
              color: rgb(0.176, 0.216, 0.282),
            });

            currentX += badgeWidth + badgeMargin;
          }

          currentY -= 40;
        } else {
          currentY = drawText("No skills listed", margin, currentY);
          currentY -= 25;
        }

        currentY -= 10;
      }

      // Certifications section
      if (
        payload.experiences.certification &&
        payload.experiences.certification.length > 0
      ) {
        if (currentY < margin + 80) {
          page = pdfDoc.addPage(pageSize);
          currentY = height - margin;
        }

        currentY = drawSectionHeading("CERTIFICATIONS", currentY);

        // Certification entries
        for (const cert of payload.experiences.certification) {
          if (currentY < margin + 40) {
            page = pdfDoc.addPage(pageSize);
            currentY = height - margin;
          }

          // Create a row with title on left and dates on right
          if (cert.title || cert.organisation) {
            const titleY = currentY;
            let certText = "";
            if (cert.title) certText += sanitizeText(cert.title);
            if (cert.organisation) {
              if (certText) certText += " - ";
              certText += sanitizeText(cert.organisation);
            }

            currentY = drawText(certText, margin, currentY, {
              font: timesRomanBold,
              size: 11,
              color: [0.176, 0.216, 0.282],
            });

            if (cert.start_date) {
              drawText(
                formatDate(cert.start_date),
                margin + contentWidth * 0.7,
                titleY,
                {
                  font: timesRoman,
                  size: 9,
                  color: [0.443, 0.502, 0.588],
                  maxWidth: contentWidth * 0.3,
                  align: "right",
                }
              );
            }
          }

          if (cert.description) {
            currentY = drawText(cert.description, margin + 10, currentY, {
              maxWidth: contentWidth - 10,
              color: [0.29, 0.333, 0.408],
            });
          }

          currentY -= itemSpacing;
        }

        currentY -= sectionSpacing - itemSpacing;
      }

      // Add footer to the last page only with logo
      const pageCount = pdfDoc.getPageCount();
      const lastPage = pdfDoc.getPage(pageCount - 1);
      const { width: pageWidth, height: pageHeight } = lastPage.getSize();

      try {
        const imageUrl = "https://edx-forum.vercel.app/xclerator-team.png";
        const imageBase64 = await fetchImageAsBase64(imageUrl);

        const logoImage = await pdfDoc.embedPng(imageBase64);
        const logoWidth = 20;
        const logoHeight = 20;
        const footerText = "Powered by xcelerator";
        const textWidth = timesRomanBold.widthOfTextAtSize(footerText, 10);

        // Calculate positions for centered layout
        const combinedWidth = logoWidth + 5 + textWidth;
        const startX = (pageWidth - combinedWidth) / 2;

        // Draw the logo
        lastPage.drawImage(logoImage, {
          x: startX,
          y: 25,
          width: logoWidth,
          height: logoHeight,
        });

        lastPage.drawText(footerText, {
          x: startX + logoWidth + 5,
          y: 30,
          size: 10,
          font: timesRomanBold,
          color: rgb(
            parseInt(COLORS.secondary.slice(1, 3), 16) / 255,
            parseInt(COLORS.secondary.slice(3, 5), 16) / 255,
            parseInt(COLORS.secondary.slice(5, 7), 16) / 255
          ),
        });
      } catch (error) {
        logger.warn("Error adding logo to footer", { error });

        lastPage.drawText("Powered by xcelerator", {
          x:
            pageWidth / 2 -
            timesRomanBold.widthOfTextAtSize("Powered by xcelerator", 10) / 2,
          y: 30,
          size: 10,
          font: timesRomanBold,
          color: rgb(
            parseInt(COLORS.secondary.slice(1, 3), 16) / 255,
            parseInt(COLORS.secondary.slice(3, 5), 16) / 255,
            parseInt(COLORS.secondary.slice(5, 7), 16) / 255
          ),
        });
      }

      // Generate PDF bytes
      const pdfBytes = await pdfDoc.save();

      // Return the result
      logger.log("Resume PDF generated successfully", {
        userId: payload.user_id,
        pdfSize: pdfBytes.length,
        pages: pdfDoc.getPageCount(),
      });

      // const fileUrl = await savePdfLocally(
      //   `${payload.job_id}/${sanitizeText(payload.meta_data.usn)}.pdf`,
      //   Buffer.from(pdfBytes).toString("base64")
      // );
      // console.log(fileUrl);

      const url =await uploadPdfToR2(
        `${payload.job_id}/${sanitizeText(payload.meta_data.usn)}.pdf`,Buffer.from(pdfBytes).toString("base64")
      )
      console.log("url for the resume is ",url);

      return {
        success: true,
        fileName: `${payload.job_id}/${sanitizeText(payload.meta_data.usn)}.pdf`,
        fileSize: pdfBytes.length,
        pageCount: pdfDoc.getPageCount(),
        // fileUrl: fileUrl,
      };
    } catch (error) {
      logger.error("Error generating PDF", { error });
      throw error;
    }
  },
});

async function savePdfLocally(fileName: string, fileData: string) {
  try {
    const filePath = path.join(__dirname, fileName); // Save in the current directory
    fs.writeFileSync(filePath, fileData, "base64"); // If fileData is base64 encoded
    console.log(`PDF saved locally at: ${filePath}`);
    return filePath;
  } catch (error) {
    console.error("Error saving PDF locally", error);
    throw error;
  }
}

async function uploadPdfToR2(fileName: string, fileData: string) {
  try {
    const buffer = Buffer.from(fileData, "base64"); // Convert base64 to Buffer

    const uploadParams = {
      Bucket: BUCKET_NAME,
      Key: fileName,
      Body: buffer,
      ContentType: "application/pdf",
    };

    await s3.send(new PutObjectCommand(uploadParams));

    const fileUrl = `${PUBLIC_DOMAIN}/${fileName}`;
    console.log(`PDF uploaded successfully: ${fileUrl}`);
    return fileUrl;
  } catch (error) {
    console.error("Error uploading PDF to R2", error);
    throw error;
  }
}