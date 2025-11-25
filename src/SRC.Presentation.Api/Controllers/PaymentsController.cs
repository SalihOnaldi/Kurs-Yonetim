using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using SRC.Application.Options;
using SRC.Infrastructure.Data;

namespace SRC.Presentation.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class PaymentsController : ControllerBase
{
    private readonly SrcDbContext _context;
    private readonly PaymentDefaultsOptions _paymentDefaults;

    public PaymentsController(SrcDbContext context, IOptions<PaymentDefaultsOptions> paymentDefaults)
    {
        _context = context;
        _paymentDefaults = paymentDefaults.Value;
    }

    [HttpGet]
    public async Task<ActionResult> GetAll(
        [FromQuery] int? studentId,
        [FromQuery] string? status,
        [FromQuery] string? paymentType,
        [FromQuery] string? branch,
        [FromQuery] int? mebGroupId)
    {
        var query = _context.Payments
            .Include(p => p.Student)
            .Include(p => p.Enrollment)
                .ThenInclude(e => e!.MebGroup)
            .AsQueryable();

        if (studentId.HasValue)
        {
            query = query.Where(p => p.StudentId == studentId.Value);
        }

        if (!string.IsNullOrWhiteSpace(status))
        {
            var normalized = status.Trim().ToLowerInvariant();
            query = query.Where(p => p.Status.ToLower() == normalized);
        }

        if (!string.IsNullOrWhiteSpace(paymentType))
        {
            var normalized = paymentType.Trim().ToLowerInvariant();
            query = query.Where(p => p.PaymentType.ToLower() == normalized);
        }

        if (!string.IsNullOrWhiteSpace(branch))
        {
            var normalized = branch.Trim().ToLowerInvariant();
            query = query.Where(p =>
                p.Enrollment != null &&
                p.Enrollment.MebGroup != null &&
                p.Enrollment.MebGroup.Branch != null &&
                p.Enrollment.MebGroup.Branch.ToLower() == normalized);
        }

        if (mebGroupId.HasValue)
        {
            query = query.Where(p => p.Enrollment != null && p.Enrollment.MebGroupId == mebGroupId.Value);
        }

        var payments = await query
            .OrderByDescending(p => p.DueDate)
            .Select(p => new
            {
                p.Id,
                StudentInfo = new
                {
                    p.Student.Id,
                    p.Student.TcKimlikNo,
                    p.Student.FirstName,
                    p.Student.LastName
                },
                GroupInfo = p.Enrollment != null && p.Enrollment.MebGroup != null ? new
                {
                    p.Enrollment.MebGroup.Id,
                    p.Enrollment.MebGroup.SrcType,
                    p.Enrollment.MebGroup.GroupNo,
                    p.Enrollment.MebGroup.Branch
                } : null,
                p.Amount,
                p.DueDate,
                p.PaidDate,
                p.PaymentType,
                p.PenaltyAmount,
                p.Description,
                p.ReceiptNo,
                p.EnrollmentId,
                p.Status,
                p.CreatedAt
            })
            .ToListAsync();

        return Ok(payments);
    }

    [HttpGet("defaults")]
    public ActionResult GetDefaults()
    {
        return Ok(new
        {
            _paymentDefaults.AutoCreateOnStudentCreate,
            _paymentDefaults.Amount,
            _paymentDefaults.PaymentType,
            _paymentDefaults.DueDays,
            _paymentDefaults.PenaltyAmount,
            _paymentDefaults.Description
        });
    }

    [HttpPost]
    public async Task<ActionResult> Create([FromBody] CreatePaymentRequest request)
    {
        var student = await _context.Students.FindAsync(request.StudentId);
        if (student == null)
        {
            return BadRequest(new { message = "Kursiyer bulunamadı" });
        }

        var payment = new SRC.Domain.Entities.Payment
        {
            StudentId = request.StudentId,
            EnrollmentId = request.EnrollmentId,
            Amount = request.Amount,
            DueDate = request.DueDate,
            PaymentType = request.PaymentType,
            PenaltyAmount = request.PenaltyAmount,
            Description = request.Description,
            Status = "pending",
            CreatedAt = DateTime.UtcNow
        };

        _context.Payments.Add(payment);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetAll), new { id = payment.Id }, payment);
    }

    [HttpPost("students/{studentId}/apply-default")]
    public async Task<ActionResult> ApplyDefault(int studentId, [FromBody] ApplyDefaultPaymentRequest request)
    {
        var student = await _context.Students
            .Include(s => s.Enrollments)
                .ThenInclude(e => e.MebGroup)
            .FirstOrDefaultAsync(s => s.Id == studentId);

        if (student == null)
        {
            return NotFound(new { message = "Kursiyer bulunamadı" });
        }

        var amount = request.Amount ?? _paymentDefaults.Amount;
        if (amount <= 0)
        {
            return BadRequest(new { message = "Varsayılan ödeme tutarı 0'dan büyük olmalıdır." });
        }

        var dueDays = request.DueDays ?? _paymentDefaults.DueDays;
        var dueDate = request.DueDate ?? DateTime.UtcNow.Date.AddDays(Math.Max(0, dueDays));

        var paymentType = string.IsNullOrWhiteSpace(request.PaymentType)
            ? _paymentDefaults.PaymentType
            : request.PaymentType!;

        if (string.IsNullOrWhiteSpace(paymentType))
        {
            paymentType = "course_fee";
        }

        int? enrollmentId = null;
        if (request.EnrollmentId.HasValue)
        {
            if (student.Enrollments.All(e => e.Id != request.EnrollmentId.Value))
            {
                return BadRequest(new { message = "Kursiyer belirtilen kayıt ile ilişkilendirilmemiş." });
            }
            enrollmentId = request.EnrollmentId.Value;
        }
        else if (request.MebGroupId.HasValue)
        {
            var enrollment = student.Enrollments.FirstOrDefault(e => e.MebGroupId == request.MebGroupId.Value);
            if (enrollment != null)
            {
                enrollmentId = enrollment.Id;
            }
        }
        else if (student.Enrollments.Count == 1)
        {
            enrollmentId = student.Enrollments.First().Id;
        }

        var payment = new SRC.Domain.Entities.Payment
        {
            StudentId = studentId,
            EnrollmentId = enrollmentId,
            Amount = amount,
            DueDate = dueDate,
            PaymentType = paymentType,
            PenaltyAmount = request.PenaltyAmount ?? _paymentDefaults.PenaltyAmount,
            Description = string.IsNullOrWhiteSpace(request.Description) ? _paymentDefaults.Description : request.Description,
            Status = "pending",
            CreatedAt = DateTime.UtcNow
        };

        _context.Payments.Add(payment);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetAll), new { id = payment.Id }, payment);
    }

    [HttpPut("{id}")]
    public async Task<ActionResult> Update(int id, [FromBody] UpdatePaymentRequest request)
    {
        var payment = await _context.Payments.FindAsync(id);
        if (payment == null)
        {
            return NotFound();
        }

        if (request.Amount.HasValue)
        {
            payment.Amount = request.Amount.Value;
        }

        if (request.DueDate.HasValue)
        {
            payment.DueDate = request.DueDate.Value;
        }

        if (request.PaidDate.HasValue)
        {
            payment.PaidDate = request.PaidDate.Value;
        }

        if (request.PaymentType != null)
        {
            payment.PaymentType = request.PaymentType;
        }

        if (request.PenaltyAmount.HasValue)
        {
            payment.PenaltyAmount = request.PenaltyAmount.Value;
        }

        if (request.Description != null)
        {
            payment.Description = request.Description;
        }

        if (request.ReceiptNo != null)
        {
            payment.ReceiptNo = request.ReceiptNo;
        }

        if (request.Status != null)
        {
            payment.Status = request.Status;
        }

        if (request.EnrollmentId.HasValue)
        {
            payment.EnrollmentId = request.EnrollmentId.Value;
        }

        payment.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return Ok(payment);
    }

    [HttpPut("{id}/pay")]
    public async Task<ActionResult> MarkAsPaid(int id, [FromBody] MarkPaymentPaidRequest request)
    {
        var payment = await _context.Payments.FindAsync(id);
        if (payment == null)
        {
            return NotFound();
        }

        payment.PaidDate = request.PaidDate ?? DateTime.UtcNow;
        payment.ReceiptNo = request.ReceiptNo;
        payment.Status = "paid";
        payment.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return Ok(payment);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var payment = await _context.Payments.FindAsync(id);
        if (payment == null)
        {
            return NotFound();
        }

        _context.Payments.Remove(payment);
        await _context.SaveChangesAsync();

        return NoContent();
    }
}

public class CreatePaymentRequest
{
    public int StudentId { get; set; }
    public int? EnrollmentId { get; set; }
    public decimal Amount { get; set; }
    public DateTime DueDate { get; set; }
    public string PaymentType { get; set; } = string.Empty;
    public decimal? PenaltyAmount { get; set; }
    public string? Description { get; set; }
}

public class MarkPaymentPaidRequest
{
    public DateTime? PaidDate { get; set; }
    public string? ReceiptNo { get; set; }
}

public class ApplyDefaultPaymentRequest
{
    public decimal? Amount { get; set; }
    public int? DueDays { get; set; }
    public DateTime? DueDate { get; set; }
    public string? PaymentType { get; set; }
    public decimal? PenaltyAmount { get; set; }
    public string? Description { get; set; }
    public int? EnrollmentId { get; set; }
    public int? MebGroupId { get; set; }
}

public class UpdatePaymentRequest
{
    public decimal? Amount { get; set; }
    public DateTime? DueDate { get; set; }
    public DateTime? PaidDate { get; set; }
    public string? PaymentType { get; set; }
    public decimal? PenaltyAmount { get; set; }
    public string? Description { get; set; }
    public string? ReceiptNo { get; set; }
    public string? Status { get; set; }
    public int? EnrollmentId { get; set; }
}

