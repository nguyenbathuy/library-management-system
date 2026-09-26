import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
    const password = await bcrypt.hash('123', 10)

    // Seed Users
    const admin = await prisma.user.upsert({
        where: { email: 'admin@library.com' },
        update: {},
        create: {
            email: 'admin@library.com',
            name: 'Thủ thư',
            password,
            role: 'ADMIN',
        },
    })

    const user = await prisma.user.upsert({
        where: { email: 'user@library.com' },
        update: {},
        create: {
            email: 'user@library.com',
            name: 'Độc giả',
            password,
            role: 'USER',
        },
    })

    console.log({ admin, user })

    // Seed Books
    const booksData = [
        { title: 'Dế Mèn Phiêu Lưu Ký', author: 'Tô Hoài', isbn: '978-604-2-07669-1', category: 'Thiếu nhi', status: 'Available', copies: 10, available: 8, publishedYear: '1941', publisher: 'NXB Kim Đồng', pageCount: 144, language: 'Tiếng Việt', description: 'Cuộc phiêu lưu đầy thú vị và bài học đường đời của chú Dế Mèn.', coverImage: 'https://product.hstatic.net/200000343865/product/de-men-phieu-luu-ki-18x25-bia-cung-tai-ban-2020_0_8aa783050b20439c9940131626a8782f_master.jpg' },
        { title: 'Đất Rừng Phương Nam', author: 'Đoàn Giỏi', isbn: '978-604-2-12345-6', category: 'Tiểu thuyết', status: 'Available', copies: 6, available: 5, publishedYear: '1957', publisher: 'NXB Văn Nghệ', pageCount: 350, language: 'Tiếng Việt', description: 'Thiên nhiên và con người Nam Bộ hào sảng qua bước chân bé An.', coverImage: 'https://salt.tikicdn.com/cache/w1200/media/catalog/product/i/m/img404_4.jpg' },
        { title: 'Số Đỏ', author: 'Vũ Trọng Phụng', isbn: '978-604-69-8263-9', category: 'Văn học', status: 'Available', copies: 5, available: 5, publishedYear: '1936', publisher: 'Văn học', pageCount: 240, language: 'Tiếng Việt', description: 'Bi hài kịch về xã hội âu hóa rởm đời qua nhân vật Xuân Tóc Đỏ.', coverImage: 'https://cdn0.fahasa.com/media/flashmagazine/images/page_images/so_do_tai_ban/2023_01_09_13_59_57_1-390x510.jpg' },
        { title: 'Mắt Biếc', author: 'Nguyễn Nhật Ánh', isbn: '978-604-1-15283-9', category: 'Truyện dài', status: 'Available', copies: 8, available: 6, publishedYear: '1990', publisher: 'NXB Trẻ', pageCount: 300, language: 'Tiếng Việt', description: 'Mối tình đơn phương day dứt của Ngạn dành cho Hà Lan.', coverImage: 'https://cdn0.fahasa.com/media/catalog/product/n/x/nxbtre_full_06402022_014041_1.jpg' },
        { title: 'Tuổi Thơ Dữ Dội', author: 'Phùng Quán', isbn: '978-604-2-02345-1', category: 'Lịch sử', status: 'Borrowed', copies: 3, available: 0, publishedYear: '1988', publisher: 'NXB Kim Đồng', pageCount: 800, language: 'Tiếng Việt', description: 'Câu chuyện xúc động về các chiến sĩ nhỏ tuổi Vệ quốc đoàn.', coverImage: 'https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1466681704i/30737014.jpg' },
        { title: 'Tắt Đèn', author: 'Ngô Tất Tố', isbn: '978-604-1-12312-3', category: 'Văn học', status: 'Available', copies: 5, available: 5, publishedYear: '1939', publisher: 'Văn học', pageCount: 180, language: 'Tiếng Việt', description: 'Bức tranh hiện thực về nỗi khổ của người nông dân dưới ách thực dân.', coverImage: 'https://i.gr-assets.com/images/S/compressed.photo.goodreads.com/books/1479993956l/13147425._SX318_.jpg' },
        { title: 'Chí Phèo', author: 'Nam Cao', isbn: '978-604-5-67890-1', category: 'Truyện ngắn', status: 'Available', copies: 4, available: 1, publishedYear: '1941', publisher: 'Văn học', pageCount: 150, language: 'Tiếng Việt', description: 'Bi kịch tha hóa và khát vọng hoàn lương của người nông dân.', coverImage: 'https://cdn0.fahasa.com/media/flashmagazine/images/page_images/chi_pheo_tai_ban_2020/2020_05_19_13_57_56_1-390x510.jpg' },
        { title: 'Kính Vạn Hoa', author: 'Nguyễn Nhật Ánh', isbn: '978-604-1-22222-2', category: 'Thiếu nhi', status: 'Available', copies: 12, available: 10, publishedYear: '1995', publisher: 'NXB Kim Đồng', pageCount: 200, language: 'Tiếng Việt', description: 'Những câu chuyện học trò tinh nghịch của Quý ròm, Tiểu Long và Hạnh.', coverImage: 'https://bookbuy.vn/Res/Images/Product/kinh-van-hoa-tap-1-phien-ban-moi-tai-ban-2018-_90719_1.jpg' },
        { title: 'Vang Bóng Một Thời', author: 'Nguyễn Tuân', isbn: '978-604-1-11111-1', category: 'Tùy bút', status: 'Available', copies: 4, available: 4, publishedYear: '1940', publisher: 'Văn học', pageCount: 200, language: 'Tiếng Việt', description: 'Vẻ đẹp cổ kính, thanh tao của một thời đã qua.', coverImage: 'https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1630547621i/13600473.jpg' },
        { title: 'Truyện Kiều', author: 'Nguyễn Du', isbn: '978-604-1-33333-3', category: 'Thơ', status: 'Available', copies: 10, available: 9, publishedYear: '1820', publisher: 'Văn học', pageCount: 150, language: 'Tiếng Việt', description: 'Kiệt tác văn học vĩ đại nhất của dân tộc Việt Nam.', coverImage: 'https://bizweb.dktcdn.net/100/180/408/products/truyen-kieu.jpg?v=1650998688027' },
        { title: 'Cánh Đồng Bất Tận', author: 'Nguyễn Ngọc Tư', isbn: '978-604-1-33445-5', category: 'Truyện ngắn', status: 'Available', copies: 5, available: 3, publishedYear: '2005', publisher: 'NXB Trẻ', pageCount: 200, language: 'Tiếng Việt', description: 'Phận người trôi nổi trên vùng sông nước miền Tây đầy ám ảnh.', coverImage: 'https://sachnoi.vip/wp-content/uploads/2023/01/canh-dong-bat-tan.jpg' },
        { title: 'Nỗi Buồn Chiến Tranh', author: 'Bảo Ninh', isbn: '978-604-1-00000-0', category: 'Tiểu thuyết', status: 'Available', copies: 5, available: 2, publishedYear: '1990', publisher: 'NXB Trẻ', pageCount: 300, language: 'Tiếng Việt', description: 'Ký ức chiến tranh ám ảnh qua cái nhìn của người lính.', coverImage: 'https://reviewsach.net/wp-content/uploads/2018/10/war.jpg' },
        { title: 'Búp Sen Xanh', author: 'Sơn Tùng', isbn: '978-604-1-99999-9', category: 'Lịch sử', status: 'Available', copies: 8, available: 7, publishedYear: '1982', publisher: 'NXB Kim Đồng', pageCount: 400, language: 'Tiếng Việt', description: 'Thời niên thiếu và tuổi trẻ đầy hoài bão của Bác Hồ.', coverImage: 'https://chiasemoi.com/wp-content/uploads/2020/08/sach-bup-sen-xanh.jpg' },
        { title: 'Cho Tôi Xin Một Vé Đi Tuổi Thơ', author: 'Nguyễn Nhật Ánh', isbn: '978-604-1-09876-5', category: 'Truyện dài', status: 'Available', copies: 10, available: 2, publishedYear: '2008', publisher: 'NXB Trẻ', pageCount: 220, language: 'Tiếng Việt', description: 'Tấm vé tàu quay ngược thời gian để tìm lại sự trong trẻo.', coverImage: 'https://cdn0.fahasa.com/media/catalog/product/n/x/nxbtre_full_22142021_051437_1.jpg' },
        { title: 'Hà Nội Băm Sáu Phố Phường', author: 'Thạch Lam', isbn: '978-604-1-33221-8', category: 'Tùy bút', status: 'Available', copies: 5, available: 5, publishedYear: '1943', publisher: 'Văn học', pageCount: 180, language: 'Tiếng Việt', description: 'Những trang văn tinh tế lưu giữ hồn cốt và ẩm thực Hà Nội xưa.', coverImage: 'https://ntthnue.edu.vn/uploads/Images/2016/11/127.jpg' },
        { title: 'Vợ Nhặt', author: 'Kim Lân', isbn: '978-604-1-55555-1', category: 'Truyện ngắn', status: 'Available', copies: 6, available: 6, publishedYear: '1962', publisher: 'Văn học', pageCount: 120, language: 'Tiếng Việt', description: 'Tình người ấm áp trong nạn đói khủng khiếp năm 1945.', coverImage: 'https://cdn0.fahasa.com/media/flashmagazine/images/page_images/vo_nhat___kim_lan/2020_06_17_16_21_32_1-390x510.jpg' },
        { title: 'Bỉ Vỏ', author: 'Nguyên Hồng', isbn: '978-604-1-77777-2', category: 'Tiểu thuyết', status: 'Available', copies: 4, available: 3, publishedYear: '1938', publisher: 'Đời Nay', pageCount: 250, language: 'Tiếng Việt', description: 'Cuộc đời bi thảm của Tám Bính trong xã hội cũ.', coverImage: 'https://bookbuy.vn/Res/Images/Product/bi-vo_116652_1.PNG' },
        { title: 'Chiếc Thuyền Ngoài Xa', author: 'Nguyễn Minh Châu', isbn: '978-604-1-88888-3', category: 'Truyện ngắn', status: 'Available', copies: 5, available: 4, publishedYear: '1983', publisher: 'Văn học', pageCount: 160, language: 'Tiếng Việt', description: 'Cái nhìn đa chiều về cuộc sống sau vẻ đẹp của chiếc thuyền.', coverImage: 'https://tse1.mm.bing.net/th/id/OIP.gKyqmE3RLH84XuwZEucLUwAAAA?pid=Api&P=0&h=180' },
        { title: 'Giông Tố', author: 'Vũ Trọng Phụng', isbn: '978-604-1-99999-4', category: 'Tiểu thuyết', status: 'Available', copies: 5, available: 5, publishedYear: '1936', publisher: 'Văn học', pageCount: 300, language: 'Tiếng Việt', description: 'Sự tha hóa của xã hội thực dân phong kiến qua vụ án Thị Mịch.', coverImage: 'https://s3.studylib.net/store/data/025294607_1-8505dc2194009bafc9a272ce0b9c9bb7-768x994.png' },
        { title: 'Lão Hạc', author: 'Nam Cao', isbn: '978-604-1-00001-5', category: 'Truyện ngắn', status: 'Available', copies: 6, available: 6, publishedYear: '1943', publisher: 'Văn học', pageCount: 100, language: 'Tiếng Việt', description: 'Số phận đau thương và phẩm chất cao quý của người nông dân.', coverImage: 'https://2.bp.blogspot.com/-V6TQJ5bvhJQ/XCNEo_4RU5I/AAAAAAAAAb4/0l6mm33r14sEQmnf3vtxYOoqTbkvIMi1ACLcBGAs/s1600/lao_hac__nam_cao.jpg' },
        { title: 'Hòn Đất', author: 'Anh Đức', isbn: '978-604-1-00002-6', category: 'Cách mạng', status: 'Available', copies: 5, available: 5, publishedYear: '1966', publisher: 'Văn học', pageCount: 280, language: 'Tiếng Việt', description: 'Cuộc chiến đấu kiên cường của quân dân vùng Hòn Đất.', coverImage: 'https://dilib.vn/img/news/2024/09/larger/7310-hon-dat-1.jpg?v=2170' },
        { title: 'Mùa Lạc', author: 'Nguyễn Khải', isbn: '978-604-1-00003-7', category: 'Truyện ngắn', status: 'Available', copies: 4, available: 4, publishedYear: '1960', publisher: 'Văn học', pageCount: 150, language: 'Tiếng Việt', description: 'Sự đổi thay của con người và vùng đất Điện Biên.', coverImage: 'https://trovetuoitho.com/wp-content/uploads/2021/01/Mua-Lac-Nguyen-Khai.jpg' },
        { title: 'Nhật Ký Đặng Thùy Trâm', author: 'Đặng Thùy Trâm', isbn: '978-604-2-99887-7', category: 'Hồi ký', status: 'Available', copies: 7, available: 7, publishedYear: '2005', publisher: 'Hội Nhà Văn', pageCount: 320, language: 'Tiếng Việt', description: 'Những dòng nhật ký đầy lửa của nữ bác sĩ tại chiến trường.', coverImage: 'https://lomonoxop.edu.vn/uploads/image/tran_phuong/image/2016_2017/thongbao/gioithieusach/gtsach10_2016.jpg' },
        { title: 'Tôi Thấy Hoa Vàng Trên Cỏ Xanh', author: 'Nguyễn Nhật Ánh', isbn: '978-604-1-77777-7', category: 'Truyện dài', status: 'Available', copies: 10, available: 5, publishedYear: '2010', publisher: 'NXB Trẻ', pageCount: 300, language: 'Tiếng Việt', description: 'Những rung động đầu đời và tình anh em cảm động.', coverImage: 'https://www.vietbookalley.com.au/cdn/shop/products/nna-toi-thay-hoa-vang-tren-co-xanh_1100x.webp?v=1660838219' },
        { title: 'Tuổi Hai Mươi Yêu Dấu', author: 'Nguyễn Huy Thiệp', isbn: '978-604-1-88888-9', category: 'Tiểu thuyết', status: 'Available', copies: 5, available: 5, publishedYear: '2003', publisher: 'NXB Trẻ', pageCount: 250, language: 'Tiếng Việt', description: 'Góc nhìn trần trụi về giới trẻ thành thị.', coverImage: 'https://ebookvie.com/wp-content/uploads/2023/12/37058423123_43f6bd1008_o.jpg' }
    ]

    for (const book of booksData) {
        await prisma.book.create({
            data: book
        })
    }
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
